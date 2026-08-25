"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { readJsonStrict, writeJsonAtomic } = require("./persistence");

const EVAL_SCHEMA_VERSION = "1";
const EVAL_RESULT_KIND = "agent-playbook-eval-result";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 300000;
const MAX_SCENARIOS = 20;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const SCENARIO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CANDIDATE_ID_PATTERN = /^cand-[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const RESULT_ID_PATTERN = /^eval-[A-Za-z0-9-]{10,140}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ENVIRONMENT_POLICY = "minimal-v1";
const SAFE_ENV_KEYS = new Set([
  "CI",
  "COLORTERM",
  "COMSPEC",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "NO_COLOR",
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
  "USERPROFILE",
  "WINDIR",
]);
const VALID_PHASES = new Set(["baseline", "candidate"]);
const EXPECTATION_KEYS = [
  "stdout_includes",
  "stdout_excludes",
  "stderr_includes",
  "stderr_excludes",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertStringList(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`${label} must be an array with at most 20 strings.`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || !item || item.length > 240) {
      throw new Error(`${label} must contain non-empty strings up to 240 characters.`);
    }
    return item;
  });
}

function normalizeExpectation(expectation, scenarioId) {
  if (expectation !== undefined && (!expectation || typeof expectation !== "object" || Array.isArray(expectation))) {
    throw new Error(`Scenario ${scenarioId} expect must be an object.`);
  }
  const source = expectation || {};
  const exitCode = source.exit_code === undefined ? 0 : source.exit_code;
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
    throw new Error(`Scenario ${scenarioId} expect.exit_code must be an integer from 0 to 255.`);
  }
  const normalized = { exit_code: exitCode };
  EXPECTATION_KEYS.forEach((key) => {
    normalized[key] = assertStringList(source[key], `Scenario ${scenarioId} expect.${key}`);
  });
  return normalized;
}

function normalizeCommand(command, scenarioId) {
  if (
    !Array.isArray(command) ||
    command.length === 0 ||
    command.length > 64 ||
    command.some((part) => typeof part !== "string" || !part || part.length > 4096)
  ) {
    throw new Error(`Scenario ${scenarioId} command must be a non-empty string array.`);
  }
  return [...command];
}

function loadEvalArtifact(artifactPath, candidateId) {
  const resolvedPath = path.resolve(artifactPath);
  if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
    throw new Error(`Invalid candidate id for evaluation: ${candidateId}.`);
  }
  const artifact = readJsonStrict(resolvedPath, null);
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    throw new Error(`Invalid eval artifact in ${resolvedPath}.`);
  }
  if (String(artifact.schema_version) !== EVAL_SCHEMA_VERSION) {
    throw new Error(`Unsupported eval artifact schema ${artifact.schema_version || "missing"}.`);
  }
  if (!artifact.candidate_id || artifact.candidate_id !== candidateId) {
    throw new Error(`Eval artifact candidate_id must match ${candidateId}.`);
  }
  if (
    !Array.isArray(artifact.scenarios) ||
    artifact.scenarios.length === 0 ||
    artifact.scenarios.length > MAX_SCENARIOS
  ) {
    throw new Error(`Eval artifact scenarios must contain 1-${MAX_SCENARIOS} entries.`);
  }

  const artifactDir = path.dirname(resolvedPath);
  const ids = new Set();
  const scenarios = artifact.scenarios.map((scenario, index) => {
    if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
      throw new Error(`Eval scenario ${index + 1} must be an object.`);
    }
    const id = String(scenario.id || "");
    if (!SCENARIO_ID_PATTERN.test(id) || ids.has(id)) {
      throw new Error(`Eval scenario id must be unique and use letters, numbers, dot, underscore, or dash: ${id || "missing"}.`);
    }
    ids.add(id);
    const phase = String(scenario.phase || "");
    if (!VALID_PHASES.has(phase)) {
      throw new Error(`Scenario ${id} phase must be baseline or candidate.`);
    }
    const cwd = scenario.cwd ? path.resolve(artifactDir, scenario.cwd) : artifactDir;
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Scenario ${id} cwd is not a directory: ${cwd}`);
    }
    const timeoutMs = scenario.timeout_ms === undefined ? DEFAULT_TIMEOUT_MS : scenario.timeout_ms;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error(`Scenario ${id} timeout_ms must be between 100 and ${MAX_TIMEOUT_MS}.`);
    }
    return {
      id,
      phase,
      cwd,
      command: normalizeCommand(scenario.command, id),
      timeoutMs,
      expect: normalizeExpectation(scenario.expect, id),
    };
  });

  if (!scenarios.some((scenario) => scenario.phase === "candidate")) {
    throw new Error("Eval artifact must include at least one candidate scenario.");
  }

  return {
    path: resolvedPath,
    sha256: sha256(fs.readFileSync(resolvedPath)),
    candidateId,
    scenarios,
  };
}

function evaluateStringAssertions(output, included, excluded) {
  return {
    includes: included.every((value) => output.includes(value)),
    excludes: excluded.every((value) => !output.includes(value)),
  };
}

function buildExecutionEnvironment(source) {
  const environment = { AGENT_PLAYBOOK_EVAL: "1" };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (SAFE_ENV_KEYS.has(key.toUpperCase()) && value !== undefined) {
      environment[key] = String(value);
    }
  });
  return environment;
}

function executeScenario(scenario) {
  const started = Date.now();
  const execution = spawnSync(scenario.command[0], scenario.command.slice(1), {
    cwd: scenario.cwd,
    encoding: "utf8",
    env: buildExecutionEnvironment(process.env),
    shell: false,
    timeout: scenario.timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  const stdout = String(execution.stdout || "");
  const stderr = String(execution.stderr || "");
  const stdoutAssertions = evaluateStringAssertions(
    stdout,
    scenario.expect.stdout_includes,
    scenario.expect.stdout_excludes
  );
  const stderrAssertions = evaluateStringAssertions(
    stderr,
    scenario.expect.stderr_includes,
    scenario.expect.stderr_excludes
  );
  const assertions = {
    exit_code: execution.status === scenario.expect.exit_code,
    stdout_includes: stdoutAssertions.includes,
    stdout_excludes: stdoutAssertions.excludes,
    stderr_includes: stderrAssertions.includes,
    stderr_excludes: stderrAssertions.excludes,
  };
  const timedOut = Boolean(execution.error && execution.error.code === "ETIMEDOUT");
  const spawnError = execution.error && !timedOut ? execution.error.message : null;
  const passed = !timedOut && !spawnError && Object.values(assertions).every(Boolean);

  return {
    persisted: {
      id: scenario.id,
      phase: scenario.phase,
      passed,
      duration_ms: Date.now() - started,
      exit_code: Number.isInteger(execution.status) ? execution.status : null,
      signal: execution.signal || null,
      timed_out: timedOut,
      spawn_error: Boolean(spawnError),
      assertions,
      command_sha256: sha256(JSON.stringify(scenario.command)),
      stdout_sha256: sha256(stdout),
      stderr_sha256: sha256(stderr),
    },
    diagnostic: {
      id: scenario.id,
      passed,
      timedOut,
      spawnError,
      exitCode: execution.status,
      stdout: stdout.slice(0, 500),
      stderr: stderr.slice(0, 500),
    },
  };
}

function runEvalArtifact({ artifactPath, candidateId, resultDir }) {
  const artifact = loadEvalArtifact(artifactPath, candidateId);
  const startedAt = new Date();
  const executed = artifact.scenarios.map(executeScenario);
  const scenarios = executed.map((item) => item.persisted);
  const completedAt = new Date();
  const id = `eval-${completedAt.toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  const result = {
    schema_version: EVAL_SCHEMA_VERSION,
    kind: EVAL_RESULT_KIND,
    id,
    candidate_id: candidateId,
    artifact_sha256: artifact.sha256,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    environment_policy: ENVIRONMENT_POLICY,
    passed: scenarios.every((scenario) => scenario.passed),
    summary: {
      total: scenarios.length,
      passed: scenarios.filter((scenario) => scenario.passed).length,
      failed: scenarios.filter((scenario) => !scenario.passed).length,
      baseline: scenarios.filter((scenario) => scenario.phase === "baseline").length,
      candidate: scenarios.filter((scenario) => scenario.phase === "candidate").length,
    },
    scenarios,
  };
  const resultPath = path.join(path.resolve(resultDir), candidateId, `${id}.json`);
  writeJsonAtomic(resultPath, result, { mode: 0o600 });
  return {
    result,
    resultPath,
    diagnostics: executed.map((item) => item.diagnostic),
  };
}

function loadEvalResult(resultPath, candidateId, options = {}) {
  const resolvedPath = path.resolve(resultPath);
  if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
    throw new Error(`Invalid candidate id for eval result: ${candidateId}.`);
  }
  assertEvalResultPath(resolvedPath, candidateId, options.resultDir);
  const result = readJsonStrict(resolvedPath, null);
  if (
    !result ||
    result.kind !== EVAL_RESULT_KIND ||
    String(result.schema_version) !== EVAL_SCHEMA_VERSION ||
    result.environment_policy !== ENVIRONMENT_POLICY ||
    !Array.isArray(result.scenarios)
  ) {
    throw new Error(`Invalid Agent Playbook eval result in ${resolvedPath}.`);
  }
  if (!RESULT_ID_PATTERN.test(String(result.id || ""))) {
    throw new Error(`Eval result in ${resolvedPath} has an invalid id.`);
  }
  if (path.basename(resolvedPath) !== `${result.id}.json`) {
    throw new Error(`Eval result filename does not match ${result.id}.`);
  }
  if (result.candidate_id !== candidateId) {
    throw new Error(`Eval result candidate_id does not match ${candidateId}.`);
  }
  if (!SHA256_PATTERN.test(String(result.artifact_sha256 || ""))) {
    throw new Error(`Eval result ${result.id} has an invalid artifact hash.`);
  }
  if (result.scenarios.length === 0 || result.scenarios.length > MAX_SCENARIOS) {
    throw new Error(`Eval result ${result.id} has an invalid scenario count.`);
  }

  const scenarioIds = new Set();
  result.scenarios.forEach((scenario) =>
    validateScenarioResult(scenario, scenarioIds, result.id)
  );
  if (!result.scenarios.some((scenario) => scenario.phase === "candidate")) {
    throw new Error(`Eval result ${result.id} has no candidate scenario.`);
  }

  const computedSummary = {
    total: result.scenarios.length,
    passed: result.scenarios.filter((scenario) => scenario.passed).length,
    failed: result.scenarios.filter((scenario) => !scenario.passed).length,
    baseline: result.scenarios.filter((scenario) => scenario.phase === "baseline").length,
    candidate: result.scenarios.filter((scenario) => scenario.phase === "candidate").length,
  };
  if (
    !result.summary ||
    Object.entries(computedSummary).some(([key, value]) => result.summary[key] !== value)
  ) {
    throw new Error(`Eval result ${result.id} has an inconsistent summary.`);
  }

  const scenarioPass = result.scenarios.every((scenario) => scenario.passed === true);
  if (result.passed !== scenarioPass) {
    throw new Error(`Eval result ${result.id} has inconsistent pass state.`);
  }
  if (options.requirePassed && result.passed !== true) {
    throw new Error(`Eval result ${result.id} did not pass.`);
  }
  return result;
}

function assertEvalResultPath(resolvedPath, candidateId, resultDir) {
  let stat;
  try {
    stat = fs.lstatSync(resolvedPath);
  } catch (error) {
    throw new Error(`Eval result is not a regular file: ${resolvedPath}.`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Eval result must be a regular file inside its candidate directory.");
  }

  if (!resultDir) {
    return;
  }
  const allowedRoot = path.resolve(resultDir, candidateId);
  const relative = path.relative(allowedRoot, resolvedPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Eval result must be inside ${allowedRoot}.`);
  }

  let realRoot;
  let realResult;
  try {
    realRoot = fs.realpathSync(allowedRoot);
    realResult = fs.realpathSync(resolvedPath);
  } catch (error) {
    throw new Error(`Eval result must be a regular file inside ${allowedRoot}.`);
  }
  const realRelative = path.relative(realRoot, realResult);
  if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`Eval result must be a regular file inside ${allowedRoot}.`);
  }
}

function validateScenarioResult(scenario, ids, resultId) {
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
    throw new Error(`Eval result ${resultId} contains an invalid scenario.`);
  }
  if (!SCENARIO_ID_PATTERN.test(String(scenario.id || "")) || ids.has(scenario.id)) {
    throw new Error(`Eval result ${resultId} contains an invalid or duplicate scenario id.`);
  }
  ids.add(scenario.id);
  if (!VALID_PHASES.has(scenario.phase)) {
    throw new Error(`Eval result ${resultId} contains an invalid scenario phase.`);
  }
  if (
    typeof scenario.passed !== "boolean" ||
    !Number.isInteger(scenario.duration_ms) ||
    scenario.duration_ms < 0 ||
    (scenario.exit_code !== null && !Number.isInteger(scenario.exit_code)) ||
    typeof scenario.timed_out !== "boolean" ||
    typeof scenario.spawn_error !== "boolean" ||
    !scenario.assertions ||
    typeof scenario.assertions !== "object" ||
    EXPECTATION_KEYS.concat("exit_code").some(
      (key) => typeof scenario.assertions[key] !== "boolean"
    ) ||
    !SHA256_PATTERN.test(String(scenario.command_sha256 || "")) ||
    !SHA256_PATTERN.test(String(scenario.stdout_sha256 || "")) ||
    !SHA256_PATTERN.test(String(scenario.stderr_sha256 || ""))
  ) {
    throw new Error(`Eval result ${resultId} contains malformed scenario evidence.`);
  }
  const computedPass =
    !scenario.timed_out &&
    !scenario.spawn_error &&
    Object.values(scenario.assertions).every((value) => value === true);
  if (scenario.passed !== computedPass) {
    throw new Error(`Eval result ${resultId} contains inconsistent scenario evidence.`);
  }
}

module.exports = {
  EVAL_SCHEMA_VERSION,
  loadEvalArtifact,
  loadEvalResult,
  runEvalArtifact,
};

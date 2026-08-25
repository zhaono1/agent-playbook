"use strict";

const fs = require("fs");
const path = require("path");

const CONFORMANCE_SCHEMA_VERSION = 1;
const MANAGED_HOOK_SOURCE = "agent-playbook";

function collectHostConformance(input) {
  const expectedSkills = listSkills(input.skillsSource);
  const hosts = [
    buildClaudeReport(input.hosts.claude, expectedSkills),
    buildCodexReport(input.hosts.codex, expectedSkills),
    buildSkillOnlyReport("gemini-cli", "Gemini CLI", input.hosts.gemini, expectedSkills),
    buildSkillOnlyReport(
      "deepseek-harness",
      "DeepSeek Harness",
      input.hosts.dsh,
      expectedSkills
    ),
  ];
  const checks = hosts.flatMap((host) => Object.values(host.capabilities));
  const hasFailure = checks.some((check) => check.status === "failed");
  const hasProof = checks.some((check) => check.status === "proven");

  return {
    schema_version: CONFORMANCE_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    package_version: input.packageVersion,
    scope: "local-static",
    overall: hasFailure ? "failed" : hasProof ? "pass" : "not-configured",
    qualification:
      "Local static proof only. Host discovery and runtime invocation require an observed host run.",
    hosts,
  };
}

function buildClaudeReport(host, expectedSkills) {
  const distribution = inspectSkillDistribution(
    host.skillsDir,
    resolveExpectedSkills(host, expectedSkills)
  );
  return {
    id: "claude-code",
    name: "Claude Code",
    capabilities: {
      skill_distribution: distribution,
      installation_manifest: inspectInstallationManifest(host, distribution),
      lifecycle_adapter: inspectClaudeLifecycleAdapter(host.settingsPath, host.localCliPath),
      host_discovery: unverified("No Claude runtime discovery was executed."),
      runtime_invocation: unverified("No Claude hook invocation was observed."),
    },
  };
}

function inspectInstallationManifest(host, distribution) {
  if (host.manifestReadable === false) {
    return { status: "failed", evidence: "The Agent Playbook manifest is invalid JSON." };
  }
  if (host.manifestPresent === true) {
    return { status: "proven", evidence: "The Agent Playbook manifest is readable." };
  }
  return distribution.status === "not-configured"
    ? { status: "not-configured", evidence: "No Agent Playbook manifest is installed." }
    : {
        status: "unverified",
        evidence: "Skill files exist without an Agent Playbook installation manifest.",
      };
}

function buildCodexReport(host, expectedSkills) {
  const distribution = inspectSkillDistribution(
    host.skillsDir,
    resolveExpectedSkills(host, expectedSkills)
  );
  let localMetadata;
  if (host.metadataPresent) {
    localMetadata = {
      status: "proven",
      evidence: "Agent Playbook's local TOML ownership marker is present.",
    };
  } else if (distribution.status === "not-configured") {
    localMetadata = { status: "not-configured", evidence: "No local installation detected." };
  } else {
    localMetadata = {
      status: "failed",
      evidence: "Skills are installed but the local Agent Playbook ownership marker is missing.",
    };
  }

  return {
    id: "codex",
    name: "Codex",
    capabilities: {
      skill_distribution: distribution,
      local_metadata: localMetadata,
      lifecycle_adapter: unsupported("Agent Playbook does not install a Codex lifecycle adapter."),
      host_discovery: unverified("No Codex runtime discovery was executed."),
      runtime_invocation: unverified("No Codex skill invocation was observed."),
    },
  };
}

function buildSkillOnlyReport(id, name, host, expectedSkills) {
  return {
    id,
    name,
    capabilities: {
      skill_distribution: inspectSkillDistribution(
        host.skillsDir,
        resolveExpectedSkills(host, expectedSkills)
      ),
      lifecycle_adapter: unsupported(
        `Agent Playbook does not install a ${name} lifecycle adapter.`
      ),
      host_discovery: unverified(`No ${name} runtime discovery was executed.`),
      runtime_invocation: unverified(`No ${name} skill invocation was observed.`),
    },
  };
}

function resolveExpectedSkills(host, fallback) {
  if (!Array.isArray(host.expectedSkills)) {
    return fallback;
  }
  return Array.from(new Set(host.expectedSkills)).sort();
}

function inspectSkillDistribution(skillsDir, expectedSkills) {
  const installedSkills = listSkills(skillsDir);
  if (!expectedSkills.length) {
    return installedSkills.length
      ? {
          status: "unverified",
          evidence: `${installedSkills.length} skill directories exist, but the source set is unavailable for comparison.`,
          expected: null,
          present: installedSkills.length,
          missing: [],
        }
      : {
          status: "not-configured",
          evidence: "No skill source or installed skills were found.",
          expected: null,
          present: 0,
          missing: [],
        };
  }

  const installed = new Set(installedSkills);
  const missing = expectedSkills.filter((name) => !installed.has(name));
  if (!installedSkills.length) {
    return {
      status: "not-configured",
      evidence: "No Agent Playbook skills are installed.",
      expected: expectedSkills.length,
      present: 0,
      missing,
    };
  }

  return {
    status: missing.length ? "failed" : "proven",
    evidence: missing.length
      ? `${missing.length} expected skill directories are missing.`
      : `All ${expectedSkills.length} expected skill directories contain SKILL.md.`,
    expected: expectedSkills.length,
    present: expectedSkills.length - missing.length,
    missing,
  };
}

function inspectClaudeLifecycleAdapter(settingsPath, localCliPath) {
  const settings = readJson(settingsPath);
  if (settings === null) {
    return fs.existsSync(settingsPath)
      ? { status: "failed", evidence: "Claude settings.json is not valid JSON." }
      : { status: "not-configured", evidence: "Claude hooks are not configured." };
  }
  if (typeof settings !== "object" || Array.isArray(settings)) {
    return { status: "failed", evidence: "Claude settings.json has an invalid schema." };
  }

  const sessionHandlers = findManagedHandlers(settings, "SessionEnd", "session-log");
  const failureHandlers = findManagedHandlers(
    settings,
    "PostToolUseFailure",
    "self-improve"
  );
  if (!sessionHandlers.length && !failureHandlers.length) {
    return { status: "not-configured", evidence: "Claude hooks are not configured." };
  }
  if (sessionHandlers.length !== 1 || failureHandlers.length !== 1) {
    return {
      status: "failed",
      evidence: "Managed Claude hooks are partial or duplicated.",
    };
  }

  const checks = [
    validateExecHandler(sessionHandlers[0], localCliPath, "session-log"),
    validateExecHandler(failureHandlers[0], localCliPath, "self-improve"),
  ];
  const failure = checks.find((check) => !check.ok);
  return failure
    ? { status: "failed", evidence: failure.reason }
    : {
        status: "proven",
        evidence:
          "SessionEnd and PostToolUseFailure use command-plus-args handlers with no shell field.",
      };
}

function findManagedHandlers(settings, eventName, subcommand) {
  const entries = settings?.hooks?.[eventName];
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .flatMap((entry) => (Array.isArray(entry?.hooks) ? entry.hooks : []))
    .filter((handler) => {
      const values = [handler?.command, ...(Array.isArray(handler?.args) ? handler.args : [])];
      const text = values.map((value) => String(value || "")).join(" ");
      return (
        text.includes(subcommand) &&
        text.includes(`--hook-source ${MANAGED_HOOK_SOURCE}`)
      );
    });
}

function validateExecHandler(handler, localCliPath, subcommand) {
  if (
    handler?.type !== "command" ||
    typeof handler.command !== "string" ||
    !handler.command.trim()
  ) {
    return { ok: false, reason: `${subcommand} is not a command hook.` };
  }
  if (!Array.isArray(handler.args)) {
    return {
      ok: false,
      reason: `${subcommand} uses a legacy shell command instead of command-plus-args.`,
    };
  }
  if (!handler.args.every((value) => typeof value === "string")) {
    return { ok: false, reason: `${subcommand} contains a non-string command argument.` };
  }
  if (Object.hasOwn(handler, "shell")) {
    return { ok: false, reason: `${subcommand} must not define a shell field.` };
  }
  if (handler.args[0] !== localCliPath || handler.args[1] !== subcommand) {
    return { ok: false, reason: `${subcommand} does not target the managed local CLI.` };
  }
  const markerIndex = handler.args.indexOf("--hook-source");
  if (markerIndex === -1 || handler.args[markerIndex + 1] !== MANAGED_HOOK_SOURCE) {
    return { ok: false, reason: `${subcommand} is missing the managed hook source marker.` };
  }
  if (!fs.existsSync(localCliPath)) {
    return { ok: false, reason: "The managed local hook CLI does not exist." };
  }
  return { ok: true };
}

function listSkills(root) {
  if (!root || !fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(root, name, "SKILL.md")))
    .sort();
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function unsupported(evidence) {
  return { status: "unsupported", evidence };
}

function unverified(evidence) {
  return { status: "unverified", evidence };
}

module.exports = {
  CONFORMANCE_SCHEMA_VERSION,
  collectHostConformance,
};

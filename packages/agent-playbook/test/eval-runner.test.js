"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  loadEvalResult,
  runEvalArtifact,
} = require("../src/eval-runner");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-playbook-eval-"));
}

function writeArtifact(root, candidateId, scenarios) {
  const artifactPath = path.join(root, "behavior-eval.json");
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schema_version: "1",
        candidate_id: candidateId,
        name: "Behavior regression evaluation",
        scenarios,
      },
      null,
      2
    ),
    "utf8"
  );
  return artifactPath;
}

test("eval artifact executes baseline and candidate scenarios without persisting output", () => {
  const root = makeTempDir();
  const candidateId = "cand-eval-pass";
  const artifactPath = writeArtifact(root, candidateId, [
    {
      id: "baseline-reproduces",
      phase: "baseline",
      command: [process.execPath, "-e", "process.stderr.write('known failure'); process.exit(1)"],
      expect: { exit_code: 1, stderr_includes: ["known failure"] },
    },
    {
      id: "candidate-fixes",
      phase: "candidate",
      command: [process.execPath, "-e", "process.stdout.write('behavior-ok')"],
      expect: { exit_code: 0, stdout_includes: ["behavior-ok"] },
    },
  ]);

  const executed = runEvalArtifact({
    artifactPath,
    candidateId,
    resultDir: path.join(root, "results"),
  });

  assert.strictEqual(executed.result.passed, true);
  assert.strictEqual(executed.result.summary.baseline, 1);
  assert.strictEqual(executed.result.summary.candidate, 1);
  assert.strictEqual(executed.result.scenarios.length, 2);
  assert.ok(executed.result.scenarios.every((scenario) => scenario.passed));
  assert.ok(executed.result.scenarios.every((scenario) => !Object.hasOwn(scenario, "stdout")));
  assert.ok(executed.result.scenarios.every((scenario) => !Object.hasOwn(scenario, "stderr")));
  assert.strictEqual(fs.statSync(executed.resultPath).mode & 0o777, 0o600);

  const loaded = loadEvalResult(executed.resultPath, candidateId);
  assert.strictEqual(loaded.id, executed.result.id);
  assert.strictEqual(loaded.passed, true);
  assert.throws(
    () => loadEvalResult(executed.resultPath, candidateId, { resultDir: path.join(root, "other") }),
    /must be inside/
  );
});

test("eval artifact rejects shell strings instead of executing them", () => {
  const root = makeTempDir();
  const candidateId = "cand-eval-unsafe";
  const artifactPath = writeArtifact(root, candidateId, [
    {
      id: "unsafe-shell",
      phase: "candidate",
      command: "echo unsafe && touch should-not-exist",
      expect: { exit_code: 0 },
    },
  ]);

  assert.throws(
    () =>
      runEvalArtifact({
        artifactPath,
        candidateId,
        resultDir: path.join(root, "results"),
      }),
    /command must be a non-empty string array/
  );
  assert.ok(!fs.existsSync(path.join(root, "should-not-exist")));
});

test("eval artifact rejects candidate ids that could escape the result directory", () => {
  const root = makeTempDir();
  const artifactPath = writeArtifact(root, "../escape", [
    {
      id: "candidate",
      phase: "candidate",
      command: [process.execPath, "-e", "process.exit(0)"],
      expect: { exit_code: 0 },
    },
  ]);

  assert.throws(
    () =>
      runEvalArtifact({
        artifactPath,
        candidateId: "../escape",
        resultDir: path.join(root, "results"),
      }),
    /Invalid candidate id/
  );
  assert.ok(!fs.existsSync(path.join(root, "escape")));
});

test("eval scenarios do not inherit arbitrary parent credentials", () => {
  const root = makeTempDir();
  const candidateId = "cand-eval-minimal-env";
  const secretKey = "APB_TEST_PARENT_SECRET";
  const previous = process.env[secretKey];
  process.env[secretKey] = "must-not-reach-child";
  try {
    const artifactPath = writeArtifact(root, candidateId, [
      {
        id: "candidate-no-secret",
        phase: "candidate",
        command: [
          process.execPath,
          "-e",
          `process.exit(process.env.${secretKey} ? 1 : 0)`,
        ],
        expect: { exit_code: 0 },
      },
    ]);
    const executed = runEvalArtifact({
      artifactPath,
      candidateId,
      resultDir: path.join(root, "results"),
    });

    assert.equal(executed.result.passed, true);
    assert.equal(executed.result.environment_policy, "minimal-v1");
  } finally {
    if (previous === undefined) {
      delete process.env[secretKey];
    } else {
      process.env[secretKey] = previous;
    }
  }
});

test("failed executable evaluation is persisted but cannot load as passing", () => {
  const root = makeTempDir();
  const candidateId = "cand-eval-fail";
  const artifactPath = writeArtifact(root, candidateId, [
    {
      id: "candidate-regresses",
      phase: "candidate",
      command: [process.execPath, "-e", "process.stdout.write('wrong')"],
      expect: { exit_code: 0, stdout_includes: ["expected"] },
    },
  ]);

  const executed = runEvalArtifact({
    artifactPath,
    candidateId,
    resultDir: path.join(root, "results"),
  });

  assert.strictEqual(executed.result.passed, false);
  assert.strictEqual(executed.result.scenarios[0].assertions.stdout_includes, false);
  assert.throws(() => loadEvalResult(executed.resultPath, candidateId, { requirePassed: true }), /did not pass/);
});

test("eval result validation rejects a tampered summary", () => {
  const root = makeTempDir();
  const candidateId = "cand-eval-tampered";
  const artifactPath = writeArtifact(root, candidateId, [
    {
      id: "candidate-passes",
      phase: "candidate",
      command: [process.execPath, "-e", "process.exit(0)"],
      expect: { exit_code: 0 },
    },
  ]);
  const executed = runEvalArtifact({
    artifactPath,
    candidateId,
    resultDir: path.join(root, "results"),
  });
  const tampered = JSON.parse(fs.readFileSync(executed.resultPath, "utf8"));
  tampered.summary.passed = 999;
  fs.writeFileSync(executed.resultPath, JSON.stringify(tampered), "utf8");

  assert.throws(
    () => loadEvalResult(executed.resultPath, candidateId, { requirePassed: true }),
    /inconsistent summary/
  );
});

test("eval result validation rejects symlink escapes from the candidate directory", (context) => {
  if (process.platform === "win32") {
    context.skip("Creating symlinks is not consistently permitted on Windows CI.");
    return;
  }
  const root = makeTempDir();
  const candidateId = "cand-eval-symlink";
  const artifactPath = writeArtifact(root, candidateId, [
    {
      id: "candidate-passes",
      phase: "candidate",
      command: [process.execPath, "-e", "process.exit(0)"],
      expect: { exit_code: 0 },
    },
  ]);
  const resultDir = path.join(root, "results");
  const executed = runEvalArtifact({ artifactPath, candidateId, resultDir });
  const outsidePath = path.join(root, "outside.json");
  fs.copyFileSync(executed.resultPath, outsidePath);
  const linkPath = path.join(resultDir, candidateId, "linked.json");
  fs.symlinkSync(outsidePath, linkPath);

  assert.throws(
    () => loadEvalResult(linkPath, candidateId, { resultDir }),
    /regular file inside/
  );
});

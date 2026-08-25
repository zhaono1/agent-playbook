"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const binPath = path.resolve(__dirname, "..", "bin", "agent-playbook.js");
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
).version;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-playbook-"));
}

test("session-log writes summary with commands and questions", () => {
  const tempDir = makeTempDir();
  const transcriptPath = path.join(tempDir, "transcript.jsonl");
  const sessionDir = path.join(tempDir, "sessions");

  const events = [
    { role: "user", content: "Create a PRD" },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Run:\n```bash\nls -la\n```\nWhat next?",
        },
      ],
    },
  ];

  fs.writeFileSync(transcriptPath, events.map((event) => JSON.stringify(event)).join("\n"));

  const result = spawnSync(
    process.execPath,
    [
      binPath,
      "session-log",
      "--transcript-path",
      transcriptPath,
      "--cwd",
      tempDir,
      "--session-dir",
      sessionDir,
    ],
    { encoding: "utf8", input: "" }
  );

  assert.strictEqual(result.status, 0);

  const files = fs.readdirSync(sessionDir).filter((file) => file.endsWith(".md"));
  assert.strictEqual(files.length, 1);

  const content = fs.readFileSync(path.join(sessionDir, files[0]), "utf8");
  assert.match(content, /Commands detected: 1/);
  assert.match(content, /ls -la/);
  assert.match(content, /What next\?/);
  assert.match(
    content,
    new RegExp(`\\*\\*Agent Playbook Version\\*\\*: ${packageVersion.replace(/\./g, "\\.")}`)
  );
});

test("session-log limits repeated transcript details", () => {
  const tempDir = makeTempDir();
  const transcriptPath = path.join(tempDir, "transcript.jsonl");
  const sessionDir = path.join(tempDir, "sessions");
  const commands = Array.from({ length: 20 }, (_, index) => `echo command-${index}`);

  const events = [
    { role: "user", content: "Summarize this long session" },
    {
      role: "assistant",
      content: `Run:\n\`\`\`bash\n${commands.join("\n")}\n\`\`\``,
    },
  ];

  fs.writeFileSync(transcriptPath, events.map((event) => JSON.stringify(event)).join("\n"));

  const result = spawnSync(
    process.execPath,
    [
      binPath,
      "session-log",
      "--transcript-path",
      transcriptPath,
      "--cwd",
      tempDir,
      "--session-dir",
      sessionDir,
    ],
    { encoding: "utf8", input: "" }
  );

  assert.strictEqual(result.status, 0);

  const files = fs.readdirSync(sessionDir).filter((file) => file.endsWith(".md"));
  assert.strictEqual(files.length, 1);

  const content = fs.readFileSync(path.join(sessionDir, files[0]), "utf8");
  assert.match(content, /Commands detected: 12/);
  assert.match(content, /echo command-11/);
  assert.doesNotMatch(content, /echo command-12/);
});

test("self-improve captures redacted failures and deduplicates candidates", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const input = JSON.stringify({
    session_id: "test-session",
    cwd: repoRoot,
    hook_event_name: "PostToolUseFailure",
    tool_name: "Bash",
    tool_input: { command: "deploy --password=never-store-this" },
    error: "Authorization: Bearer private-token-value caused timeout",
  });

  for (let index = 0; index < 2; index += 1) {
    const result = spawnSync(
      process.execPath,
      [binPath, "self-improve", "--data-dir", dataDir],
      { encoding: "utf8", input }
    );
    assert.strictEqual(result.status, 0);
  }

  const storePath = path.join(dataDir, "self-improvement", "candidates.json");
  const storeText = fs.readFileSync(storePath, "utf8");
  const store = JSON.parse(storeText);
  assert.strictEqual(store.items.length, 1);
  assert.strictEqual(store.items[0].occurrences, 2);
  assert.match(store.items[0].summary, /\[REDACTED\]/);
  assert.doesNotMatch(storeText, /private-token-value|never-store-this/);
});

test("self-improve does not deduplicate projects with the same directory name", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const projectA = path.join(tempDir, "customer-a", "frontend");
  const projectB = path.join(tempDir, "customer-b", "frontend");
  fs.mkdirSync(path.join(projectA, ".git"), { recursive: true });
  fs.mkdirSync(path.join(projectB, ".git"), { recursive: true });

  for (const cwd of [projectA, projectB]) {
    const result = spawnSync(
      process.execPath,
      [
        binPath,
        "self-improve",
        "capture",
        "--data-dir",
        dataDir,
        "--kind",
        "correction",
        "--summary",
        "Keep project learning isolated",
        "--evidence",
        "focused-test",
      ],
      { encoding: "utf8", input: JSON.stringify({ cwd }) }
    );
    assert.strictEqual(result.status, 0, result.stderr);
  }

  const store = JSON.parse(
    fs.readFileSync(path.join(dataDir, "self-improvement", "candidates.json"), "utf8")
  );
  assert.strictEqual(store.items.length, 2);
  assert.notStrictEqual(store.items[0].scope, store.items[1].scope);
  assert.doesNotMatch(JSON.stringify(store), /customer-a|customer-b|frontend/);
});

test("self-improve ignores successful hook events without an explicit lesson", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const input = JSON.stringify({
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_output: "PASS",
  });

  const result = spawnSync(
    process.execPath,
    [binPath, "self-improve", "--data-dir", dataDir],
    { encoding: "utf8", input }
  );

  assert.strictEqual(result.status, 0);
  assert.match(result.stderr, /No reusable learning signal captured/);
  assert.ok(!fs.existsSync(path.join(dataDir, "self-improvement", "candidates.json")));
});

test("self-improve separates validation from application and exports lifecycle state", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const outputPath = path.join(tempDir, "vault", "learning.md");
  const summary = "Verify the current source before relying on cached state";
  const capture = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "capture",
      "--data-dir",
      dataDir,
      "--kind",
      "correction",
      "--summary",
      summary,
      "--evidence",
      "focused-test",
    ],
    { encoding: "utf8", input: "" }
  );
  assert.strictEqual(capture.status, 0);

  const list = spawnSync(
    process.execPath,
    [binPath, "self-improve", "list", "--data-dir", dataDir, "--format", "json"],
    { encoding: "utf8" }
  );
  assert.strictEqual(list.status, 0);
  const candidateId = JSON.parse(list.stdout)[0].id;

  const unvalidated = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "validate",
      "--reason",
      "confirmed by a focused test",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(unvalidated.status, 1);
  assert.match(unvalidated.stderr, /validation-method.*validation-evidence/i);

  const validated = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "validate",
      "--reason",
      "confirmed by a focused test",
      "--validation-method",
      "focused-test",
      "--validation-evidence",
      "node --test session-log.test.js",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(validated.status, 0, validated.stderr);

  const afterValidation = JSON.parse(
    spawnSync(
      process.execPath,
      [binPath, "self-improve", "list", "--data-dir", dataDir, "--format", "json"],
      { encoding: "utf8" }
    ).stdout
  );
  assert.strictEqual(afterValidation[0].status, "validated");
  assert.ok(!fs.existsSync(path.join(dataDir, "self-improvement", "active-rules.json")));

  const applied = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "apply",
      "--reason",
      "installed in the durable owner",
      "--owner",
      "skill:self-improving-agent",
      "--change-ref",
      "test:session-log",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(applied.status, 0, applied.stderr);

  const exported = spawnSync(
    process.execPath,
    [binPath, "self-improve", "export", "--data-dir", dataDir, "--output", outputPath],
    { encoding: "utf8" }
  );
  assert.strictEqual(exported.status, 0);
  const notebook = fs.readFileSync(outputPath, "utf8");
  assert.match(notebook, /## Applied Rules/);
  assert.match(notebook, new RegExp(summary));

  const active = JSON.parse(
    fs.readFileSync(path.join(dataDir, "self-improvement", "active-rules.json"), "utf8")
  );
  assert.strictEqual(active.items.length, 1);
  assert.strictEqual(active.items[0].candidate_id, candidateId);
  assert.strictEqual(active.items[0].status, "applied");
  assert.strictEqual(active.items[0].owner, "skill:self-improving-agent");
});

test("reject then recapture creates a new candidate identity", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const captureArgs = [
    binPath,
    "self-improve",
    "capture",
    "--data-dir",
    dataDir,
    "--kind",
    "correction",
    "--summary",
    "Do not repeat a rejected identity",
    "--evidence",
    "focused-test",
  ];

  assert.strictEqual(spawnSync(process.execPath, captureArgs, { encoding: "utf8" }).status, 0);
  const firstList = JSON.parse(
    spawnSync(
      process.execPath,
      [binPath, "self-improve", "list", "--data-dir", dataDir, "--format", "json"],
      { encoding: "utf8" }
    ).stdout
  );
  const firstId = firstList[0].id;
  const rejected = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      firstId,
      "--data-dir",
      dataDir,
      "--decision",
      "reject",
      "--reason",
      "not reusable",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(rejected.status, 0);

  assert.strictEqual(spawnSync(process.execPath, captureArgs, { encoding: "utf8" }).status, 0);
  const secondList = JSON.parse(
    spawnSync(
      process.execPath,
      [binPath, "self-improve", "list", "--data-dir", dataDir, "--format", "json"],
      { encoding: "utf8" }
    ).stdout
  );
  assert.strictEqual(secondList.length, 2);
  assert.notStrictEqual(secondList[0].id, secondList[1].id);
  assert.deepStrictEqual(secondList.map((item) => item.status), ["rejected", "candidate"]);
});

test("invalid self-improvement transitions fail without changing active rules", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const capture = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "capture",
      "--data-dir",
      dataDir,
      "--kind",
      "correction",
      "--summary",
      "State transitions must be explicit",
      "--evidence",
      "test",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(capture.status, 0);
  const candidateId = JSON.parse(
    spawnSync(
      process.execPath,
      [binPath, "self-improve", "list", "--data-dir", dataDir, "--format", "json"],
      { encoding: "utf8" }
    ).stdout
  )[0].id;

  const applyCandidate = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "apply",
      "--reason",
      "too early",
      "--owner",
      "skill:test",
      "--change-ref",
      "test:early",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(applyCandidate.status, 1);
  assert.match(applyCandidate.stderr, /Invalid transition.*candidate.*apply/i);

  const reject = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "reject",
      "--reason",
      "not applicable",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(reject.status, 0);

  const revive = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "validate",
      "--reason",
      "should not revive",
      "--validation-method",
      "focused-test",
      "--validation-evidence",
      "test:revive",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(revive.status, 1);
  assert.match(revive.stderr, /Invalid transition.*rejected.*validate/i);
});

test("corrupt candidate store fails closed and preserves history bytes", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const storePath = path.join(dataDir, "self-improvement", "candidates.json");
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, "{broken-candidates", "utf8");

  const result = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "capture",
      "--data-dir",
      dataDir,
      "--kind",
      "correction",
      "--summary",
      "Do not overwrite corrupt history",
      "--evidence",
      "test",
    ],
    { encoding: "utf8" }
  );

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /candidates\.json.*corrupt|unable to parse.*candidates/i);
  assert.strictEqual(fs.readFileSync(storePath, "utf8"), "{broken-candidates");
});

test("schema v1 learning history migrates deterministically before mutation", () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const storePath = path.join(dataDir, "self-improvement", "candidates.json");
  const legacyCandidate = {
    id: "cand-legacy",
    fingerprint: "legacy-fingerprint",
    status: "promoted",
    kind: "correction",
    summary: "Keep legacy learning history",
    scope: "global",
    occurrences: 1,
    evidence: [],
    reviews: [{ decision: "promote", reason: "legacy proof" }],
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(
    storePath,
    JSON.stringify({ schema_version: "1", items: [legacyCandidate, { ...legacyCandidate }] }),
    "utf8"
  );

  const listed = spawnSync(
    process.execPath,
    [binPath, "self-improve", "list", "--data-dir", dataDir, "--format", "json"],
    { encoding: "utf8" }
  );

  assert.strictEqual(listed.status, 0, listed.stderr);
  const items = JSON.parse(listed.stdout);
  assert.deepStrictEqual(items.map((item) => item.status), ["validated", "validated"]);
  assert.notStrictEqual(items[0].id, items[1].id);
  assert.deepStrictEqual(items.map((item) => item.reviews[0].decision), ["validate", "validate"]);

  const applied = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      items[0].id,
      "--data-dir",
      dataDir,
      "--decision",
      "apply",
      "--reason",
      "legacy rule already has a durable owner",
      "--owner",
      "skills/legacy/SKILL.md",
      "--change-ref",
      "legacy:migration",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(applied.status, 0, applied.stderr);
  const migrated = JSON.parse(fs.readFileSync(storePath, "utf8"));
  assert.strictEqual(migrated.schema_version, "2");
  assert.deepStrictEqual(migrated.items.map((item) => item.id), items.map((item) => item.id));
});

test("session logging defaults to private data storage and redacts captured text", () => {
  const tempDir = makeTempDir();
  const repoDir = path.join(tempDir, "repo");
  const dataDir = path.join(tempDir, "private-data");
  const transcriptPath = path.join(tempDir, "transcript.jsonl");
  fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });
  fs.writeFileSync(
    transcriptPath,
    `${JSON.stringify({ role: "user", content: "deploy password=super-secret-value" })}\n`,
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [binPath, "session-log", "--transcript-path", transcriptPath, "--cwd", repoDir, "--data-dir", dataDir],
    { encoding: "utf8", input: "" }
  );

  assert.strictEqual(result.status, 0, result.stderr);
  assert.ok(!fs.existsSync(path.join(repoDir, "sessions")));
  const sessionsRoot = path.join(dataDir, "sessions");
  const projectDirs = fs.readdirSync(sessionsRoot);
  assert.strictEqual(projectDirs.length, 1);
  const outputPath = path.join(sessionsRoot, projectDirs[0], fs.readdirSync(path.join(sessionsRoot, projectDirs[0]))[0]);
  const output = fs.readFileSync(outputPath, "utf8");
  assert.doesNotMatch(output, /super-secret-value/);
  assert.doesNotMatch(output, new RegExp(repoDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(output, /\[REDACTED\]/);
  if (process.platform !== "win32") {
    assert.strictEqual(fs.statSync(outputPath).mode & 0o777, 0o600);
  }
});

test("concurrent learning capture retains every occurrence", async () => {
  const tempDir = makeTempDir();
  const dataDir = path.join(tempDir, "data");
  const count = 10;
  const args = [
    binPath,
    "self-improve",
    "capture",
    "--data-dir",
    dataDir,
    "--kind",
    "correction",
    "--summary",
    "Concurrent evidence must not be lost",
    "--evidence",
    "parallel-test",
  ];

  const results = await Promise.all(
    Array.from(
      { length: count },
      () =>
        new Promise((resolve) => {
          const child = spawn(process.execPath, args);
          let stderr = "";
          child.stderr.setEncoding("utf8");
          child.stderr.on("data", (chunk) => {
            stderr += chunk;
          });
          child.stdin.end();
          child.on("close", (status) => resolve({ status, stderr }));
        })
    )
  );

  results.forEach((result) => assert.strictEqual(result.status, 0, result.stderr));
  const store = JSON.parse(
    fs.readFileSync(path.join(dataDir, "self-improvement", "candidates.json"), "utf8")
  );
  assert.strictEqual(store.items.length, 1);
  assert.strictEqual(store.items[0].occurrences, count);
});

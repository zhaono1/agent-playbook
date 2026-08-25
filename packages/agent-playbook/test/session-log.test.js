"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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

test("self-improve requires validation before promotion and exports markdown", () => {
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
      "promote",
      "--reason",
      "confirmed by a focused test",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(unvalidated.status, 1);
  assert.match(unvalidated.stderr, /requires --validated/);

  const promoted = spawnSync(
    process.execPath,
    [
      binPath,
      "self-improve",
      "review",
      candidateId,
      "--data-dir",
      dataDir,
      "--decision",
      "promote",
      "--reason",
      "confirmed by a focused test",
      "--validated",
    ],
    { encoding: "utf8" }
  );
  assert.strictEqual(promoted.status, 0);

  const exported = spawnSync(
    process.execPath,
    [binPath, "self-improve", "export", "--data-dir", dataDir, "--output", outputPath],
    { encoding: "utf8" }
  );
  assert.strictEqual(exported.status, 0);
  const notebook = fs.readFileSync(outputPath, "utf8");
  assert.match(notebook, /## Active Rules/);
  assert.match(notebook, new RegExp(summary));

  const active = JSON.parse(
    fs.readFileSync(path.join(dataDir, "self-improvement", "active-rules.json"), "utf8")
  );
  assert.strictEqual(active.items.length, 1);
  assert.strictEqual(active.items[0].candidate_id, candidateId);
});

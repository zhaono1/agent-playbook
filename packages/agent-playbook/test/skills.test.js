"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const binPath = path.resolve(__dirname, "..", "bin", "agent-playbook.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-playbook-"));
}

function writeSkill(targetDir, name) {
  const skillDir = path.join(targetDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: test\n---\n", "utf8");
}

test("skills list returns global skills across targets", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const codexDir = path.join(tempDir, "codex");
  const geminiDir = path.join(tempDir, "gemini");
  const dshDir = path.join(tempDir, "dsh");

  writeSkill(path.join(claudeDir, "skills"), "alpha");
  writeSkill(path.join(codexDir, "skills"), "bravo");
  writeSkill(path.join(geminiDir, "skills"), "charlie");
  writeSkill(path.join(dshDir, "skills"), "delta");

  const result = spawnSync(
    process.execPath,
    [binPath, "skills", "list", "--scope", "global", "--target", "all", "--format", "json"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: codexDir,
        AGENT_PLAYBOOK_GEMINI_DIR: geminiDir,
        AGENT_PLAYBOOK_DSH_DIR: dshDir,
      },
    }
  );

  assert.strictEqual(result.status, 0);
  const records = JSON.parse(result.stdout);
  const names = records.map((record) => record.name);
  assert.ok(names.includes("alpha"));
  assert.ok(names.includes("bravo"));
  assert.ok(names.includes("charlie"));
  assert.ok(names.includes("delta"));
});

test("skills add installs a DeepSeek Harness project skill", () => {
  const tempDir = makeTempDir();
  const sourceRoot = path.join(tempDir, "source");
  const sourceDir = path.join(sourceRoot, "dsh-skill");
  writeSkill(sourceRoot, "dsh-skill");

  const result = spawnSync(
    process.execPath,
    [
      binPath,
      "skills",
      "add",
      sourceDir,
      "--scope",
      "global",
      "--target",
      "deepseek",
      "--copy",
      "--overwrite",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
        AGENT_PLAYBOOK_CLAUDE_DIR: path.join(tempDir, "claude"),
        AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
        AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
        AGENT_PLAYBOOK_DSH_DIR: path.join(tempDir, "dsh"),
      },
    }
  );

  assert.strictEqual(result.status, 0);
  assert.ok(fs.existsSync(path.join(tempDir, "dsh", "skills", "dsh-skill", "SKILL.md")));
});

test("skills add writes state and copies skill", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const sourceRoot = path.join(tempDir, "source");
  const sourceDir = path.join(sourceRoot, "delta");

  writeSkill(sourceRoot, "delta");

  const result = spawnSync(
    process.execPath,
    [binPath, "skills", "add", sourceDir, "--scope", "global", "--target", "claude", "--copy", "--overwrite"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
        AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
      },
    }
  );

  assert.strictEqual(result.status, 0);
  const installedPath = path.join(claudeDir, "skills", "delta", "SKILL.md");
  assert.ok(fs.existsSync(installedPath));

  const statePath = path.join(tempDir, "data", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const entry = state.skills.find((item) => item.name === "delta" && item.target === "claude");
  assert.ok(entry);
  assert.strictEqual(entry.mode, "copy");
});

test("skills disable and enable toggles location", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const skillsDir = path.join(claudeDir, "skills");

  writeSkill(skillsDir, "echo");

  const disableResult = spawnSync(
    process.execPath,
    [
      binPath,
      "skills",
      "disable",
      "echo",
      "--scope",
      "global",
      "--target",
      "claude",
      "--overwrite",
      "--force",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
        AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
      },
    }
  );

  assert.strictEqual(disableResult.status, 0);
  const disabledPath = path.join(skillsDir, ".disabled", "echo", "SKILL.md");
  assert.ok(fs.existsSync(disabledPath));

  const enableResult = spawnSync(
    process.execPath,
    [binPath, "skills", "enable", "echo", "--scope", "global", "--target", "claude", "--overwrite"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
        AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
      },
    }
  );

  assert.strictEqual(enableResult.status, 0);
  const restoredPath = path.join(skillsDir, "echo", "SKILL.md");
  assert.ok(fs.existsSync(restoredPath));
});

test("skills import rejects unsafe skill names", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const sourceRoot = path.join(tempDir, "source");
  const importPath = path.join(tempDir, "state.json");
  const outsidePath = path.join(claudeDir, "outside");

  writeSkill(sourceRoot, "safe-skill");
  fs.mkdirSync(outsidePath, { recursive: true });
  fs.writeFileSync(path.join(outsidePath, "marker.txt"), "keep", "utf8");
  fs.writeFileSync(
    importPath,
    JSON.stringify(
      {
        version: "1",
        skills: [
          {
            name: "../outside",
            scope: "global",
            target: "claude",
            source: path.join(sourceRoot, "safe-skill"),
            mode: "copy",
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [binPath, "skills", "import", importPath, "--overwrite"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
        AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
      },
    }
  );

  assert.strictEqual(result.status, 0);
  assert.ok(fs.existsSync(path.join(outsidePath, "marker.txt")));
  assert.match(result.stdout, /Imported state \(0 applied, 1 skipped\)/);

  const statePath = path.join(tempDir, "data", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.deepEqual(state.skills, []);
});

test("skills upgrade ignores unsafe managed state entries", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const sourceRoot = path.join(tempDir, "source");
  const stateDir = path.join(tempDir, "data");
  const outsidePath = path.join(claudeDir, "outside");

  writeSkill(sourceRoot, "safe-skill");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(outsidePath, { recursive: true });
  fs.writeFileSync(path.join(outsidePath, "marker.txt"), "keep", "utf8");
  fs.writeFileSync(
    path.join(stateDir, "state.json"),
    JSON.stringify(
      {
        version: "1",
        skills: [
          {
            name: "../outside",
            scope: "global",
            target: "claude",
            source: path.join(sourceRoot, "safe-skill"),
            mode: "copy",
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [binPath, "skills", "upgrade", "--source", sourceRoot, "--overwrite"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_DATA_DIR: stateDir,
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
        AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
      },
    }
  );

  assert.strictEqual(result.status, 0);
  assert.ok(fs.existsSync(path.join(outsidePath, "marker.txt")));
  assert.match(result.stdout, /Upgraded 0 managed skills\. Skipped 0\./);

  const state = JSON.parse(fs.readFileSync(path.join(stateDir, "state.json"), "utf8"));
  assert.deepEqual(state.skills, []);
});

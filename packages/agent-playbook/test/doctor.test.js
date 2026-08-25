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

function writeSkill(targetDir, name) {
  const skillDir = path.join(targetDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    "---\nname: test-skill\ndescription: test\n---\n",
    "utf8"
  );
}

test("doctor reports healthy when hooks and config are present", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const codexDir = path.join(tempDir, "codex");
  const dshDir = path.join(tempDir, "dsh");
  const claudeSkillsDir = path.join(claudeDir, "skills");
  const codexSkillsDir = path.join(codexDir, "skills");

  fs.mkdirSync(claudeSkillsDir, { recursive: true });
  fs.mkdirSync(codexSkillsDir, { recursive: true });

  writeSkill(claudeSkillsDir, "test-skill");
  writeSkill(codexSkillsDir, "test-skill");

  fs.writeFileSync(
    path.join(claudeSkillsDir, ".agent-playbook.json"),
    JSON.stringify({ name: "agent-playbook" }, null, 2)
  );

  const localCliDir = path.join(claudeDir, "agent-playbook", "bin");
  fs.mkdirSync(localCliDir, { recursive: true });
  fs.writeFileSync(path.join(localCliDir, "agent-playbook.js"), "#!/usr/bin/env node\n");
  fs.writeFileSync(
    path.join(claudeDir, "agent-playbook", "package.json"),
    JSON.stringify({ version: packageVersion }, null, 2),
    "utf8"
  );

  const settings = {
    hooks: {
      SessionEnd: [
        {
          hooks: [
            {
              type: "command",
              command: "/tmp/agent-playbook session-log --hook-source agent-playbook",
            },
          ],
        },
      ],
      PostToolUseFailure: [
        {
          matcher: "*",
          hooks: [
            {
              type: "command",
              command: "/tmp/agent-playbook self-improve --hook-source agent-playbook",
            },
          ],
        },
      ],
    },
  };

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, "settings.json"), JSON.stringify(settings, null, 2));

  fs.mkdirSync(codexDir, { recursive: true });
  fs.writeFileSync(
    path.join(codexDir, "config.toml"),
    "[agent_playbook]\nversion = \"0.1.0\"\ninstalled_at = \"2026-01-01T00:00:00Z\"\n",
    "utf8"
  );

  const repoRoot = path.resolve(__dirname, "..", "..", "..");

  const result = spawnSync(
    process.execPath,
    [binPath, "doctor", "--repo", repoRoot],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: codexDir,
        AGENT_PLAYBOOK_DSH_DIR: dshDir,
      },
    }
  );

  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Claude hooks installed: yes/);
  assert.match(result.stdout, /Codex config block: yes/);
});

test("init writes cross-platform exec-form hooks without shell quoting", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const codexDir = path.join(tempDir, "codex");
  const geminiDir = path.join(tempDir, "gemini");
  const dshDir = path.join(tempDir, "dsh");
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const sessionDir = path.join(tempDir, "sessions with 'quote $(touch bad)");

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: "/tmp/old-apb self-improve --hook-source agent-playbook",
              },
            ],
          },
        ],
      },
    }),
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [binPath, "init", "--repo", repoRoot, "--hooks", "--session-dir", sessionDir],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
        AGENT_PLAYBOOK_CODEX_DIR: codexDir,
        AGENT_PLAYBOOK_GEMINI_DIR: geminiDir,
        AGENT_PLAYBOOK_DSH_DIR: dshDir,
      },
    }
  );

  assert.strictEqual(result.status, 0);

  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8"));
  const sessionHook = settings.hooks.SessionEnd[0].hooks[0];
  const improveHook = settings.hooks.PostToolUseFailure[0].hooks[0];
  const cliPath = path.join(claudeDir, "agent-playbook", "bin", "agent-playbook.js");

  assert.equal(sessionHook.command, process.execPath);
  assert.deepEqual(sessionHook.args, [
    cliPath,
    "session-log",
    "--hook-source",
    "agent-playbook",
    "--session-dir",
    sessionDir,
  ]);
  assert.equal(improveHook.command, process.execPath);
  assert.deepEqual(improveHook.args, [
    cliPath,
    "self-improve",
    "--hook-source",
    "agent-playbook",
  ]);
  assert.ok(!Object.hasOwn(sessionHook, "shell"));
  assert.ok(!Object.hasOwn(improveHook, "shell"));
  assert.equal((settings.hooks.PostToolUse || []).length, 0);
  assert.ok(
    fs.existsSync(path.join(dshDir, "skills", "self-improving-agent", "SKILL.md"))
  );
});

test("doctor fails closed when the shared state file is corrupt", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const codexDir = path.join(tempDir, "codex");
  const geminiDir = path.join(tempDir, "gemini");
  const dshDir = path.join(tempDir, "dsh");
  const dataDir = path.join(tempDir, "data");
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const env = {
    ...process.env,
    AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
    AGENT_PLAYBOOK_CODEX_DIR: codexDir,
    AGENT_PLAYBOOK_GEMINI_DIR: geminiDir,
    AGENT_PLAYBOOK_DSH_DIR: dshDir,
    AGENT_PLAYBOOK_DATA_DIR: dataDir,
  };

  const initialized = spawnSync(process.execPath, [binPath, "init", "--repo", repoRoot], {
    encoding: "utf8",
    env,
  });
  assert.strictEqual(initialized.status, 0, initialized.stderr);

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "state.json"), "{broken", "utf8");
  const result = spawnSync(process.execPath, [binPath, "doctor", "--repo", repoRoot], {
    encoding: "utf8",
    env,
  });

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /unable to parse Agent Playbook state\.json/);
});

test("doctor reports hook runtime version drift", () => {
  const tempDir = makeTempDir();
  const claudeDir = path.join(tempDir, "claude");
  const codexDir = path.join(tempDir, "codex");
  const geminiDir = path.join(tempDir, "gemini");
  const dshDir = path.join(tempDir, "dsh");
  const dataDir = path.join(tempDir, "data");
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const env = {
    ...process.env,
    AGENT_PLAYBOOK_CLAUDE_DIR: claudeDir,
    AGENT_PLAYBOOK_CODEX_DIR: codexDir,
    AGENT_PLAYBOOK_GEMINI_DIR: geminiDir,
    AGENT_PLAYBOOK_DSH_DIR: dshDir,
    AGENT_PLAYBOOK_DATA_DIR: dataDir,
  };

  assert.strictEqual(
    spawnSync(process.execPath, [binPath, "init", "--repo", repoRoot, "--hooks"], {
      encoding: "utf8",
      env,
    }).status,
    0
  );
  fs.writeFileSync(
    path.join(claudeDir, "agent-playbook", "package.json"),
    JSON.stringify({ version: "0.0.0-stale" }),
    "utf8"
  );

  const result = spawnSync(process.execPath, [binPath, "doctor", "--repo", repoRoot], {
    encoding: "utf8",
    env,
  });

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /hook CLI version mismatch.*0\.0\.0-stale/i);
});

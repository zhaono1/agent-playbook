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
      PostToolUse: [
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
      },
    }
  );

  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Claude hooks installed: yes/);
  assert.match(result.stdout, /Codex config block: yes/);
});

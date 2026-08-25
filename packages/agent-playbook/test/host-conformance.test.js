"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { collectHostConformance } = require("../src/host-conformance");

const binPath = path.resolve(__dirname, "..", "bin", "agent-playbook.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-playbook-conformance-"));
}

function writeSkill(root, name) {
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
}

function buildInput(tempDir) {
  const source = path.join(tempDir, "source");
  const localCliPath = path.join(tempDir, "claude", "agent-playbook", "bin", "agent-playbook.js");
  writeSkill(source, "test-skill");
  fs.mkdirSync(path.dirname(localCliPath), { recursive: true });
  fs.writeFileSync(localCliPath, "#!/usr/bin/env node\n", "utf8");

  const hosts = {};
  for (const name of ["claude", "codex", "gemini", "dsh"]) {
    const skillsDir = path.join(tempDir, name, "skills");
    writeSkill(skillsDir, "test-skill");
    hosts[name] = { skillsDir };
  }
  hosts.claude.settingsPath = path.join(tempDir, "claude", "settings.json");
  hosts.claude.localCliPath = localCliPath;
  hosts.codex.metadataPresent = true;
  return { packageVersion: "1.0.0", skillsSource: source, hosts };
}

test("conformance distinguishes local proof from unverified host runtime", () => {
  const tempDir = makeTempDir();
  const input = buildInput(tempDir);
  fs.writeFileSync(
    input.hosts.claude.settingsPath,
    JSON.stringify({
      hooks: {
        SessionEnd: [
          {
            hooks: [
              {
                type: "command",
                command: process.execPath,
                args: [
                  input.hosts.claude.localCliPath,
                  "session-log",
                  "--hook-source",
                  "agent-playbook",
                ],
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
                command: process.execPath,
                args: [
                  input.hosts.claude.localCliPath,
                  "self-improve",
                  "--hook-source",
                  "agent-playbook",
                ],
              },
            ],
          },
        ],
      },
    }),
    "utf8"
  );

  const report = collectHostConformance(input);

  assert.equal(report.overall, "pass");
  assert.equal(report.scope, "local-static");
  assert.equal(report.hosts[0].capabilities.skill_distribution.status, "proven");
  assert.equal(report.hosts[0].capabilities.lifecycle_adapter.status, "proven");
  assert.equal(report.hosts[0].capabilities.host_discovery.status, "unverified");
  assert.equal(report.hosts[1].capabilities.lifecycle_adapter.status, "unsupported");
});

test("conformance rejects legacy shell-form managed hooks", () => {
  const tempDir = makeTempDir();
  const input = buildInput(tempDir);
  fs.writeFileSync(
    input.hosts.claude.settingsPath,
    JSON.stringify({
      hooks: {
        SessionEnd: [
          {
            hooks: [
              {
                type: "command",
                command: `${input.hosts.claude.localCliPath} session-log --hook-source agent-playbook`,
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
                command: `${input.hosts.claude.localCliPath} self-improve --hook-source agent-playbook`,
              },
            ],
          },
        ],
      },
    }),
    "utf8"
  );

  const report = collectHostConformance(input);

  assert.equal(report.overall, "failed");
  assert.equal(report.hosts[0].capabilities.lifecycle_adapter.status, "failed");
  assert.match(
    report.hosts[0].capabilities.lifecycle_adapter.evidence,
    /legacy shell command/
  );
});

test("conformance fails when the managed installation manifest is corrupt", () => {
  const input = buildInput(makeTempDir());
  input.hosts.claude.manifestPresent = true;
  input.hosts.claude.manifestReadable = false;

  const report = collectHostConformance(input);

  assert.equal(report.overall, "failed");
  assert.equal(
    report.hosts[0].capabilities.installation_manifest.status,
    "failed"
  );
});

test("conformance reports missing distributed skills without claiming discovery", () => {
  const tempDir = makeTempDir();
  const input = buildInput(tempDir);
  writeSkill(input.skillsSource, "second-skill");

  const report = collectHostConformance(input);
  const gemini = report.hosts.find((host) => host.id === "gemini-cli");

  assert.equal(report.overall, "failed");
  assert.equal(gemini.capabilities.skill_distribution.status, "failed");
  assert.deepEqual(gemini.capabilities.skill_distribution.missing, ["second-skill"]);
  assert.equal(gemini.capabilities.host_discovery.status, "unverified");
});

test("conformance does not treat an unmanaged partial skill set as a full install", () => {
  const input = buildInput(makeTempDir());
  Object.values(input.hosts).forEach((host) => {
    host.expectedSkills = [];
  });

  const report = collectHostConformance(input);

  assert.equal(report.overall, "pass");
  assert.equal(report.hosts[0].capabilities.skill_distribution.status, "unverified");
  assert.match(
    report.hosts[0].capabilities.skill_distribution.evidence,
    /source set is unavailable/
  );
});

test("conformance CLI reports a hook-enabled local installation", () => {
  const tempDir = makeTempDir();
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const env = {
    ...process.env,
    AGENT_PLAYBOOK_CLAUDE_DIR: path.join(tempDir, "claude"),
    AGENT_PLAYBOOK_CODEX_DIR: path.join(tempDir, "codex"),
    AGENT_PLAYBOOK_GEMINI_DIR: path.join(tempDir, "gemini"),
    AGENT_PLAYBOOK_DSH_DIR: path.join(tempDir, "dsh"),
    AGENT_PLAYBOOK_DATA_DIR: path.join(tempDir, "data"),
  };
  const initialized = spawnSync(
    process.execPath,
    [binPath, "init", "--repo", repoRoot, "--hooks"],
    { encoding: "utf8", env }
  );
  assert.equal(initialized.status, 0, initialized.stderr);

  const result = spawnSync(
    process.execPath,
    [binPath, "conformance", "--repo", repoRoot, "--format", "json"],
    { encoding: "utf8", env }
  );

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.overall, "pass");
  assert.ok(
    report.hosts.every(
      (host) => host.capabilities.skill_distribution.status === "proven"
    )
  );
  assert.equal(report.hosts[0].capabilities.lifecycle_adapter.status, "proven");
  assert.equal(report.hosts[0].capabilities.runtime_invocation.status, "unverified");
});

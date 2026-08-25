"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const {
  collectManagedResources,
  removeManagedResources,
} = require("../src/ownership");

const binPath = path.resolve(__dirname, "..", "bin", "agent-playbook.js");
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-playbook-hardening-"));
}

function makeHostEnv(root) {
  return {
    ...process.env,
    AGENT_PLAYBOOK_DATA_DIR: path.join(root, "data"),
    AGENT_PLAYBOOK_CLAUDE_DIR: path.join(root, "claude"),
    AGENT_PLAYBOOK_CODEX_DIR: path.join(root, "codex"),
    AGENT_PLAYBOOK_GEMINI_DIR: path.join(root, "gemini"),
    AGENT_PLAYBOOK_DSH_DIR: path.join(root, "dsh"),
  };
}

function run(args, env, input = "") {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    input,
  });
}

function writeSkill(skillsDir, name, body = "# User-owned skill\n") {
  const skillDir = path.join(skillsDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), body, "utf8");
  return skillDir;
}

test("invalid target fails closed without moving any skill", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  for (const host of ["claude", "codex", "gemini", "dsh"]) {
    writeSkill(path.join(root, host, "skills"), "personal-skill");
  }

  const result = run(
    ["skills", "disable", "personal-skill", "--repo", repoRoot, "--scope", "global", "--target", "typo"],
    env
  );

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Unknown target "typo"/);
  for (const host of ["claude", "codex", "gemini", "dsh"]) {
    assert.ok(fs.existsSync(path.join(root, host, "skills", "personal-skill", "SKILL.md")));
    assert.ok(!fs.existsSync(path.join(root, host, "skills", ".disabled", "personal-skill")));
  }
});

test("invalid scope fails closed without moving any skill", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const skillsDir = path.join(root, "claude", "skills");
  writeSkill(skillsDir, "personal-skill");

  const result = run(
    [
      "skills",
      "disable",
      "personal-skill",
      "--repo",
      repoRoot,
      "--scope",
      "globla",
      "--target",
      "claude",
      "--force",
    ],
    env
  );

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Unknown scope "globla"/);
  assert.ok(fs.existsSync(path.join(skillsDir, "personal-skill", "SKILL.md")));
});

test("disable refuses an unmanaged skill unless force is explicit", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const skillsDir = path.join(root, "claude", "skills");
  writeSkill(skillsDir, "personal-skill");

  const result = run(
    ["skills", "disable", "personal-skill", "--repo", repoRoot, "--scope", "global", "--target", "claude"],
    env
  );

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /unmanaged/i);
  assert.ok(fs.existsSync(path.join(skillsDir, "personal-skill", "SKILL.md")));
  assert.ok(!fs.existsSync(path.join(skillsDir, ".disabled", "personal-skill")));
});

test("repeated init preserves ownership so uninstall removes installed links", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);

  assert.strictEqual(run(["init", "--repo", repoRoot, "--no-hooks"], env).status, 0);
  const manifestPath = path.join(root, "claude", "skills", ".agent-playbook.json");
  const firstManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.ok(firstManifest.links.claude.length > 0);

  assert.strictEqual(run(["init", "--repo", repoRoot, "--no-hooks"], env).status, 0);
  const secondManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.strictEqual(secondManifest.links.claude.length, firstManifest.links.claude.length);

  assert.strictEqual(run(["uninstall", "--repo", repoRoot], env).status, 0);
  assert.ok(!fs.existsSync(path.join(root, "claude", "skills", "skill-router")));
  assert.ok(!fs.existsSync(path.join(root, "codex", "skills", "skill-router")));
});

test("uninstall preserves a manifest target that the user replaced", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);

  assert.strictEqual(run(["init", "--repo", repoRoot, "--no-hooks"], env).status, 0);
  const target = path.join(root, "claude", "skills", "skill-router");
  fs.unlinkSync(target);
  writeSkill(path.join(root, "claude", "skills"), "skill-router", "# User replacement\n");

  const result = run(["uninstall", "--repo", repoRoot], env);

  assert.strictEqual(result.status, 0);
  assert.match(result.stderr, /ownership changed|not owned|preserving/i);
  assert.strictEqual(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), "# User replacement\n");
});

test("copied installs are removed only while their fingerprint is unchanged", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);

  assert.strictEqual(run(["init", "--repo", repoRoot, "--copy", "--no-hooks"], env).status, 0);
  const unchanged = path.join(root, "codex", "skills", "skill-router");
  const changed = path.join(root, "claude", "skills", "skill-router");
  fs.appendFileSync(path.join(changed, "SKILL.md"), "\n# User-local note\n", "utf8");

  const result = run(["uninstall", "--repo", repoRoot], env);

  assert.strictEqual(result.status, 0, result.stderr);
  assert.ok(!fs.existsSync(unchanged));
  assert.ok(fs.existsSync(path.join(changed, "SKILL.md")));
  assert.match(result.stderr, /ownership changed|preserving/i);
});

test("an owned broken link remains removable after its source moves", () => {
  const root = makeTempDir();
  const sourceRoot = path.join(root, "source");
  const targetRoot = path.join(root, "skills");
  const source = writeSkill(sourceRoot, "linked-skill");
  const target = path.join(targetRoot, "linked-skill");
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
  const resources = collectManagedResources(
    [],
    { created: [{ source, target, mode: "link" }], skipped: [] },
    targetRoot
  );
  assert.strictEqual(resources.length, 1);

  fs.rmSync(source, { recursive: true, force: true });
  const result = removeManagedResources(resources, targetRoot);

  assert.deepStrictEqual(result.preserved, []);
  assert.strictEqual(fs.lstatSync(targetRoot).isDirectory(), true);
  assert.throws(() => fs.lstatSync(target), { code: "ENOENT" });
});

test("Codex metadata block round-trips without orphaning keys into another table", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const configPath = path.join(root, "codex", "config.toml");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      "[alpha]",
      "x = 1",
      "",
      "[agent_playbook]",
      'version = "old"',
      'installed_at = "old"',
      "",
      "[beta]",
      "y = 2",
      "",
    ].join("\n"),
    "utf8"
  );

  assert.strictEqual(run(["init", "--repo", repoRoot, "--no-hooks"], env).status, 0);
  const installed = fs.readFileSync(configPath, "utf8");
  assert.match(installed, /# BEGIN agent-playbook/);
  assert.match(installed, /# END agent-playbook/);
  assert.doesNotMatch(installed, /version = "old"|installed_at = "old"/);
  assert.match(installed, /\[alpha\]\nx = 1/);
  assert.match(installed, /\[beta\]\ny = 2/);

  assert.strictEqual(run(["uninstall", "--repo", repoRoot], env).status, 0);
  const uninstalled = fs.readFileSync(configPath, "utf8");
  assert.doesNotMatch(uninstalled, /agent_playbook|installed_at|^version\s*=/m);
  assert.match(uninstalled, /\[alpha\]\nx = 1/);
  assert.match(uninstalled, /\[beta\]\ny = 2/);
});

test("malformed Codex markers stop init before any skill mutation", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const configPath = path.join(root, "codex", "config.toml");
  const malformed = "[alpha]\nx = 1\n\n# BEGIN agent-playbook\n[agent_playbook]\n";
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, malformed, "utf8");

  const doctor = run(["doctor", "--repo", repoRoot], env);
  assert.notStrictEqual(doctor.status, 0);
  assert.match(doctor.stderr, /malformed Agent Playbook marker block/i);

  const result = run(["init", "--repo", repoRoot, "--no-hooks"], env);

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Malformed Codex config/);
  assert.strictEqual(fs.readFileSync(configPath, "utf8"), malformed);
  assert.ok(!fs.existsSync(path.join(root, "claude", "skills", "skill-router")));
});

test("corrupt Claude settings stop hook-enabled init before skill mutation", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const settingsPath = path.join(root, "claude", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, "{broken-settings", "utf8");

  const result = run(["init", "--repo", repoRoot], env);

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /settings\.json.*corrupt|unable to parse.*settings/i);
  assert.strictEqual(fs.readFileSync(settingsPath, "utf8"), "{broken-settings");
  assert.ok(!fs.existsSync(path.join(root, "codex", "skills", "skill-router")));
});

test("project-scoped state uses distinct project identities", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const sourceRoot = path.join(root, "source");
  const sourceSkill = writeSkill(sourceRoot, "shared-skill", "# Shared\n");
  const projectA = path.join(root, "project-a");
  const projectB = path.join(root, "project-b");
  fs.mkdirSync(path.join(projectA, ".git"), { recursive: true });
  fs.mkdirSync(path.join(projectB, ".git"), { recursive: true });

  for (const project of [projectA, projectB]) {
    const result = run(
      ["skills", "add", sourceSkill, "--repo", project, "--scope", "project", "--target", "claude", "--copy"],
      env
    );
    assert.strictEqual(result.status, 0, result.stderr);
  }

  const statePath = path.join(root, "data", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const entries = state.skills.filter((entry) => entry.name === "shared-skill");
  assert.strictEqual(entries.length, 2);
  assert.notStrictEqual(entries[0].project_id, entries[1].project_id);

  assert.strictEqual(
    run(
      ["skills", "remove", "shared-skill", "--repo", projectA, "--scope", "project", "--target", "claude"],
      env
    ).status,
    0
  );
  assert.ok(!fs.existsSync(path.join(projectA, ".claude", "skills", "shared-skill")));
  assert.ok(fs.existsSync(path.join(projectB, ".claude", "skills", "shared-skill", "SKILL.md")));
});

test("corrupt skill state fails closed and preserves the original bytes", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const statePath = path.join(root, "data", "state.json");
  const sourceSkill = writeSkill(path.join(root, "source"), "new-skill");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, "{broken-state", "utf8");

  const result = run(
    ["skills", "add", sourceSkill, "--repo", repoRoot, "--scope", "global", "--target", "claude", "--copy"],
    env
  );

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /state\.json.*corrupt|unable to parse.*state/i);
  assert.strictEqual(fs.readFileSync(statePath, "utf8"), "{broken-state");
  assert.ok(!fs.existsSync(path.join(root, "claude", "skills", "new-skill")));
});

test("legacy shared state migrates once without modifying its source", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const legacyPath = path.join(root, "claude", "agent-playbook", "state.json");
  const statePath = path.join(root, "data", "state.json");
  const legacy = {
    version: "1",
    skills: [
      {
        name: "legacy-skill",
        scope: "global",
        target: "claude",
        enabled: true,
        mode: "copy",
      },
    ],
  };
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2), "utf8");

  const result = run(
    ["skills", "list", "--repo", repoRoot, "--scope", "global", "--target", "claude"],
    env
  );

  assert.strictEqual(result.status, 0, result.stderr);
  const migrated = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.strictEqual(migrated.version, "2");
  assert.strictEqual(migrated.skills[0].project_id, "global");
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(legacyPath, "utf8")), legacy);
});

test("repair refreshes an existing hook CLI copy", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);

  assert.strictEqual(run(["init", "--repo", repoRoot], env).status, 0);
  const localCli = path.join(root, "claude", "agent-playbook", "src", "cli.js");
  fs.writeFileSync(localCli, "// stale runtime\n", "utf8");

  assert.strictEqual(run(["repair", "--repo", repoRoot], env).status, 0);
  const repaired = fs.readFileSync(localCli, "utf8");
  assert.doesNotMatch(repaired, /stale runtime/);
  assert.match(repaired, /SELF_IMPROVEMENT_SCHEMA_VERSION/);
});

test("repair preserves ownership so a later uninstall remains complete", () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);

  assert.strictEqual(run(["init", "--repo", repoRoot, "--no-hooks"], env).status, 0);
  assert.strictEqual(run(["repair", "--repo", repoRoot, "--no-hooks"], env).status, 0);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "claude", "skills", ".agent-playbook.json"), "utf8")
  );
  assert.ok(manifest.links.claude.length > 0);
  assert.strictEqual(manifest.hooksEnabled, false);
  assert.ok(!fs.existsSync(path.join(root, "claude", "settings.json")));
  assert.ok(!fs.existsSync(path.join(root, "claude", "agent-playbook")));

  const doctor = run(["doctor", "--repo", repoRoot], env);
  assert.strictEqual(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout, /Claude hooks expected: no/);

  assert.strictEqual(run(["uninstall", "--repo", repoRoot], env).status, 0);
  assert.ok(!fs.existsSync(path.join(root, "claude", "skills", "skill-router")));
  assert.ok(!fs.existsSync(path.join(root, "dsh", "skills", "skill-router")));
});

test("concurrent skill mutations retain every managed state entry", async () => {
  const root = makeTempDir();
  const env = makeHostEnv(root);
  const sourceRoot = path.join(root, "source");
  const names = Array.from({ length: 8 }, (_, index) => `parallel-${index}`);
  names.forEach((name) => writeSkill(sourceRoot, name, `# ${name}\n`));

  const results = await Promise.all(
    names.map(
      (name) =>
        new Promise((resolve) => {
          const child = spawn(
            process.execPath,
            [
              binPath,
              "skills",
              "add",
              path.join(sourceRoot, name),
              "--repo",
              repoRoot,
              "--scope",
              "global",
              "--target",
              "claude",
              "--copy",
            ],
            { cwd: repoRoot, env }
          );
          let stderr = "";
          child.stderr.setEncoding("utf8");
          child.stderr.on("data", (chunk) => {
            stderr += chunk;
          });
          child.on("close", (status) => resolve({ status, stderr }));
        })
    )
  );

  results.forEach((result) => assert.strictEqual(result.status, 0, result.stderr));
  const state = JSON.parse(fs.readFileSync(path.join(root, "data", "state.json"), "utf8"));
  const installedNames = state.skills.map((entry) => entry.name).sort();
  assert.deepStrictEqual(installedNames, names);
});

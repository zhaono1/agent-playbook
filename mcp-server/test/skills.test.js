import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import {
  SERVER_VERSION,
  extractFrontMatter,
  getSkill,
  getSkillHooks,
  listSkills,
} from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const skillsDir = path.join(repoRoot, "skills");

test("extractFrontMatter parses nested metadata and hyphenated keys", async () => {
  const content = await fs.readFile(path.join(skillsDir, "code-reviewer", "SKILL.md"), "utf8");
  const frontMatter = extractFrontMatter(content);

  assert.equal(frontMatter.name, "code-reviewer");
  assert.ok(frontMatter.metadata?.hooks?.after_complete?.length > 0);
  assert.equal(typeof frontMatter["allowed-tools"], "string");
});

test("getSkill returns the current self-improvement contract", async () => {
  const parsed = JSON.parse(await getSkill("self-improving-agent", false, { skillsDir }));

  assert.ok(parsed.allowed_tools.includes("Read"));
  assert.ok(!parsed.allowed_tools.includes("WebSearch"));
  assert.equal(parsed.hooks, null);
});

test("getSkill rejects non-canonical skill names", async () => {
  const parsed = JSON.parse(await getSkill("../skills/create-pr/SKILL", false, { skillsDir }));

  assert.deepEqual(parsed, { error: "Skill '../skills/create-pr/SKILL' not found" });
});

test("getSkillHooks returns the full hook configuration", async () => {
  const parsed = JSON.parse(await getSkillHooks("skill-router", { skillsDir }));

  assert.ok(parsed.hooks.after_complete.length > 0);
  assert.equal(parsed.hooks.after_complete[0].trigger, "session-logger");
});

test("listSkills uses the shared catalog for category assignment", async () => {
  const skills = await listSkills(null, { skillsDir });
  const figma = skills.find((skill) => skill.name === "figma-designer");
  const planning = skills.find((skill) => skill.name === "prd-planner");

  assert.equal(figma?.category, "design");
  assert.equal(planning?.category, "planning");
  assert.equal(Object.hasOwn(figma, "path"), false);
});

test("MCP adapter version follows the playbook release line", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "mcp-server", "package.json")));

  assert.equal(SERVER_VERSION, packageJson.version);
});

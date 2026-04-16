import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { extractFrontMatter, getSkill, getSkillHooks, listSkills } from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const skillsDir = path.join(repoRoot, "skills");

test("extractFrontMatter parses nested metadata and hyphenated keys", async () => {
  const content = await fs.readFile(path.join(skillsDir, "self-improving-agent", "SKILL.md"), "utf8");
  const frontMatter = extractFrontMatter(content);

  assert.equal(frontMatter.name, "self-improving-agent");
  assert.ok(frontMatter.metadata?.hooks?.after_complete?.length > 0);
  assert.equal(typeof frontMatter["allowed-tools"], "string");
});

test("getSkill returns parsed hooks and allowed tools", async () => {
  const parsed = JSON.parse(await getSkill("self-improving-agent", false, { skillsDir }));

  assert.ok(parsed.allowed_tools.includes("Read"));
  assert.ok(parsed.allowed_tools.includes("WebSearch"));
  assert.ok(parsed.hooks.after_complete.length > 0);
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
});

"use strict";

const fs = require("fs");
const path = require("path");

const MAX_OWNER_FILE_BYTES = 32768;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "user",
  "with",
]);

function tokenize(value) {
  const matches = String(value || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return new Set(matches.filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

function readBounded(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return "";
  }
  const handle = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(MAX_OWNER_FILE_BYTES);
    const bytes = fs.readSync(handle, buffer, 0, buffer.length, 0);
    return buffer.toString("utf8", 0, bytes);
  } finally {
    fs.closeSync(handle);
  }
}

function intersectTerms(candidateTerms, ownerText) {
  const ownerTerms = tokenize(ownerText);
  return [...candidateTerms].filter((term) => ownerTerms.has(term)).sort();
}

function addInstructionOwner(owners, candidateTerms, repoRoot, fileName, baseScore) {
  const filePath = path.join(repoRoot, fileName);
  const content = readBounded(filePath);
  if (!content) {
    return;
  }
  const matchedTerms = intersectTerms(candidateTerms, content);
  owners.push({
    owner: `instructions:${fileName}`,
    type: "instructions",
    path: fileName,
    score: baseScore + matchedTerms.length * 8,
    matched_terms: matchedTerms,
    reason: matchedTerms.length
      ? "Repository instruction owner shares terms with the candidate."
      : "Repository-wide behavior may belong in the root instruction owner.",
    suggested: true,
  });
}

function addSkillOwners(owners, candidateTerms, repoRoot) {
  const skillsRoot = path.join(repoRoot, "skills");
  if (!fs.existsSync(skillsRoot) || !fs.statSync(skillsRoot).isDirectory()) {
    return;
  }
  fs.readdirSync(skillsRoot, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      return;
    }
    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
    const content = readBounded(skillPath);
    if (!content) {
      return;
    }
    const matchedTerms = intersectTerms(candidateTerms, `${entry.name} ${content}`);
    if (!matchedTerms.length) {
      return;
    }
    owners.push({
      owner: `skill:${entry.name}`,
      type: "skill",
      path: path.relative(repoRoot, skillPath),
      score: 40 + matchedTerms.length * 12,
      matched_terms: matchedTerms,
      reason: "Skill name or instructions overlap with the candidate behavior.",
      suggested: true,
    });
  });
}

function addExecutableOwner(owners, candidate, repoRoot) {
  if (candidate.kind !== "failure" && candidate.kind !== "regression") {
    return;
  }
  const testDirName = ["test", "tests"].find((name) => {
    const candidatePath = path.join(repoRoot, name);
    return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory();
  });
  if (!testDirName) {
    return;
  }
  owners.push({
    owner: `tests:${testDirName}`,
    type: "test",
    path: testDirName,
    score: candidate.kind === "regression" ? 90 : 70,
    matched_terms: [],
    reason: "Failures and regressions should prefer an executable enforcement owner when possible.",
    suggested: true,
  });
}

function resolveOwnerCandidates({ candidate, repoRoot, limit = 5 }) {
  if (!candidate || !candidate.summary) {
    throw new Error("Owner resolution requires a candidate summary.");
  }
  const resolvedRoot = path.resolve(repoRoot || process.cwd());
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Owner resolution root is not a directory: ${resolvedRoot}`);
  }
  const candidateTerms = tokenize(candidate.summary);
  const owners = [];
  addExecutableOwner(owners, candidate, resolvedRoot);
  addSkillOwners(owners, candidateTerms, resolvedRoot);
  addInstructionOwner(owners, candidateTerms, resolvedRoot, "AGENTS.md", 20);
  addInstructionOwner(owners, candidateTerms, resolvedRoot, "CLAUDE.md", 15);
  return owners
    .sort((left, right) => right.score - left.score || left.owner.localeCompare(right.owner))
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 10)));
}

module.exports = { resolveOwnerCandidates };

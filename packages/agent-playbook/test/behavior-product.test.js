"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildBehaviorInbox } = require("../src/self-improvement");
const { resolveOwnerCandidates } = require("../src/owner-resolver");
const { buildBehaviorProposal } = require("../src/behavior-proposal");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-playbook-behavior-"));
}

test("behavior inbox prioritizes regressions and exposes the next lifecycle action", () => {
  const inbox = buildBehaviorInbox({
    items: [
      {
        id: "cand-new",
        status: "candidate",
        kind: "correction",
        summary: "Keep review read only",
        occurrences: 1,
        last_seen: "2026-08-25T01:00:00.000Z",
      },
      {
        id: "cand-regression",
        status: "candidate",
        kind: "regression",
        summary: "Review mutation happened again",
        occurrences: 2,
        last_seen: "2026-08-25T02:00:00.000Z",
      },
      {
        id: "cand-validated",
        status: "validated",
        kind: "correction",
        summary: "Use current source",
        occurrences: 3,
        last_seen: "2026-08-25T03:00:00.000Z",
      },
    ],
  });

  assert.strictEqual(inbox[0].id, "cand-regression");
  assert.strictEqual(inbox[0].attention, "urgent");
  assert.strictEqual(inbox[0].next_action, "run-eval");
  assert.strictEqual(inbox.find((item) => item.id === "cand-validated").next_action, "create-proposal");
});

test("owner resolver ranks a matching skill without claiming automatic ownership", () => {
  const root = makeTempDir();
  fs.mkdirSync(path.join(root, "skills", "code-reviewer"), { recursive: true });
  fs.writeFileSync(path.join(root, "AGENTS.md"), "Repository-wide coding rules.\n", "utf8");
  fs.writeFileSync(
    path.join(root, "skills", "code-reviewer", "SKILL.md"),
    [
      "---",
      "name: code-reviewer",
      "description: Review code without editing files unless the user asks for a fix.",
      "---",
      "# Code Reviewer",
      "",
    ].join("\n"),
    "utf8"
  );

  const owners = resolveOwnerCandidates({
    candidate: {
      kind: "correction",
      summary: "Code review must not edit files unless the user asks for a fix",
    },
    repoRoot: root,
  });

  assert.strictEqual(owners[0].owner, "skill:code-reviewer");
  assert.strictEqual(owners[0].type, "skill");
  assert.ok(owners[0].matched_terms.includes("review"));
  assert.ok(owners.some((owner) => owner.owner === "instructions:AGENTS.md"));
  assert.ok(owners.every((owner) => owner.suggested === true));
});

test("behavior proposal renders eval proof, owner, acceptance criteria, and rollback", () => {
  const markdown = buildBehaviorProposal(
    {
      id: "cand-proposal",
      status: "validated",
      kind: "correction",
      summary: "Review requests remain read only",
      occurrences: 3,
      scope: "project-hash",
      validation: {
        method: "executable-eval",
        evidence: "sha256:artifact-hash",
        eval_result: {
          id: "eval-123",
          artifact_sha256: "artifact-hash",
          completed_at: "2026-08-25T01:00:00.000Z",
          summary: { total: 2, passed: 2, failed: 0, baseline: 1, candidate: 1 },
        },
      },
    },
    "skill:code-reviewer",
    { generatedAt: "2026-08-25T02:00:00.000Z" }
  );

  assert.match(markdown, /Behavior Change Proposal/);
  assert.match(markdown, /skill:code-reviewer/);
  assert.match(markdown, /2\/2 scenarios passed/);
  assert.match(markdown, /Acceptance Criteria/);
  assert.match(markdown, /Rollback Plan/);
  assert.doesNotMatch(markdown, /undefined|null/);
});

test("behavior proposal escapes hook-derived Markdown and HTML", () => {
  const candidate = {
    id: "cand-safe-proposal",
    status: "validated",
    kind: "failure",
    summary: "Never trust <script>alert(1)</script> or **unreviewed** output",
    scope: "project-test",
    occurrences: 1,
    validation: {
      eval_result: {
        id: "eval-safe-proposal",
        artifact_sha256: "a".repeat(64),
        summary: { total: 1, passed: 1, failed: 0, baseline: 0, candidate: 1 },
      },
    },
  };

  const markdown = buildBehaviorProposal(candidate, "instructions:<owner>", {
    generatedAt: "2026-08-25T00:00:00.000Z",
  });

  assert.doesNotMatch(markdown, /<script>|<owner>/);
  assert.match(markdown, /&lt;script&gt;/);
  assert.match(markdown, /\\\*\\\*unreviewed\\\*\\\*/);
  assert.match(markdown, /instructions:&lt;owner&gt;/);
});

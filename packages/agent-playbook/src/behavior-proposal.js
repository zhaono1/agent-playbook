"use strict";

function oneLine(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownText(value) {
  return oneLine(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]#])/g, "\\$1");
}

function buildBehaviorProposal(candidate, owner, options = {}) {
  if (!candidate || candidate.status !== "validated") {
    throw new Error("Behavior proposals require a validated candidate.");
  }
  const evalResult = candidate.validation && candidate.validation.eval_result;
  const summary = evalResult && evalResult.summary;
  if (
    !evalResult ||
    !summary ||
    summary.total < 1 ||
    summary.failed !== 0 ||
    summary.passed !== summary.total
  ) {
    throw new Error("Behavior proposals require a complete passing executable eval summary.");
  }
  const ownerText = oneLine(owner);
  if (!ownerText) {
    throw new Error("Behavior proposals require one explicit durable owner.");
  }
  const generatedAt = markdownText(options.generatedAt || new Date().toISOString());
  const normalizedOwner = markdownText(ownerText);
  const behavior = markdownText(candidate.summary);

  return [
    `# Behavior Change Proposal: ${behavior}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Problem",
    "",
    `- Candidate: \`${candidate.id}\``,
    `- Kind: ${markdownText(candidate.kind)}`,
    `- Repeated evidence: ${Number(candidate.occurrences) || 0} occurrence(s)`,
    `- Scope: ${markdownText(candidate.scope)}`,
    "",
    "## Proposed Behavior",
    "",
    behavior,
    "",
    "## Durable Owner",
    "",
    `- ${normalizedOwner}`,
    "- This is a suggestion until a human reviews and changes the owner.",
    "",
    "## Executable Evidence",
    "",
    `- Eval result: \`${evalResult.id}\``,
    `- Artifact SHA-256: \`${evalResult.artifact_sha256}\``,
    `- Result: ${summary.passed}/${summary.total} scenarios passed`,
    `- Baseline scenarios: ${summary.baseline}`,
    `- Candidate scenarios: ${summary.candidate}`,
    "",
    "## Acceptance Criteria",
    "",
    "- [ ] Modify only the named durable owner.",
    "- [ ] Rerun the same executable artifact after the owner change.",
    "- [ ] Keep every candidate scenario passing.",
    "- [ ] Confirm no holdout or adjacent behavior regressed.",
    "",
    "## Risk and Privacy",
    "",
    "- Raw prompts, stdout, and stderr are not included in this proposal.",
    "- Confirm the proposed owner and scope before applying the behavior.",
    "",
    "## Rollback Plan",
    "",
    "1. Revert the durable-owner change.",
    `2. Mark \`${candidate.id}\` as \`rolled_back\` with the regression evidence.`,
    "3. Rerun the executable artifact and record the result.",
    "",
  ].join("\n");
}

module.exports = { buildBehaviorProposal };

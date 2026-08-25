"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readJsonStrict, writeJsonAtomic } = require("./persistence");

const SELF_IMPROVEMENT_DIR_NAME = "self-improvement";
const SELF_IMPROVEMENT_SCHEMA_VERSION = "2";
const MAX_CANDIDATE_EVIDENCE = 10;

function resolveSelfImprovementEnvironment(options) {
  const configuredRoot = options["data-dir"] || process.env.AGENT_PLAYBOOK_DATA_DIR;
  const dataRoot = configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(os.homedir(), ".agent-playbook");
  const root = path.join(dataRoot, SELF_IMPROVEMENT_DIR_NAME);
  return {
    root,
    candidatesPath: path.join(root, "candidates.json"),
    activeRulesPath: path.join(root, "active-rules.json"),
    eventsDir: path.join(root, "events"),
    evalsDir: path.join(root, "evals"),
    lockPath: path.join(root, ".state.lock"),
  };
}

function loadCandidateStore(filePath) {
  const data = readJsonStrict(filePath, null);
  if (!data) {
    return { schema_version: SELF_IMPROVEMENT_SCHEMA_VERSION, updated_at: null, items: [] };
  }
  if (!Array.isArray(data.items)) {
    const error = new Error(`Invalid candidate store schema in ${filePath}; refusing to overwrite it.`);
    error.code = "APB_INVALID_CANDIDATE_SCHEMA";
    throw error;
  }
  if (String(data.schema_version || "1") === "1") {
    const seenIds = new Set();
    return {
      ...data,
      schema_version: SELF_IMPROVEMENT_SCHEMA_VERSION,
      items: data.items.map((item, index) => {
        const next = { ...item };
        if (seenIds.has(next.id)) {
          next.legacy_id = next.id;
          next.id = `${next.id}-legacy-${index + 1}`;
        }
        seenIds.add(next.id);
        if (next.status === "promoted") {
          next.status = "validated";
          next.legacy_status = "promoted";
        }
        next.reviews = Array.isArray(next.reviews)
          ? next.reviews.map((review) => ({
              ...review,
              decision: review.decision === "promote" ? "validate" : review.decision,
            }))
          : [];
        return next;
      }),
    };
  }
  if (String(data.schema_version) !== SELF_IMPROVEMENT_SCHEMA_VERSION) {
    const error = new Error(
      `Unsupported candidate store schema ${data.schema_version} in ${filePath}; refusing to overwrite it.`
    );
    error.code = "APB_UNSUPPORTED_CANDIDATE_SCHEMA";
    throw error;
  }
  const ids = new Set();
  for (const item of data.items) {
    if (!item || !item.id || ids.has(item.id)) {
      const error = new Error(`Candidate store ${filePath} contains an invalid or duplicate id.`);
      error.code = "APB_INVALID_CANDIDATE_ID";
      throw error;
    }
    ids.add(item.id);
  }
  return data;
}

function createCandidateFingerprint(signal) {
  return crypto
    .createHash("sha256")
    .update(`${signal.kind}\n${signal.scope}\n${signal.summary.toLowerCase()}`)
    .digest("hex");
}

function upsertLearningCandidate(store, signal, now) {
  const fingerprint = createCandidateFingerprint(signal);
  const timestamp = now.toISOString();
  let candidate = store.items.find(
    (item) =>
      item.fingerprint === fingerprint &&
      (item.status === "candidate" || item.status === "validated")
  );
  const evidence = { source: signal.evidence, observed_at: timestamp };

  if (candidate) {
    candidate.last_seen = timestamp;
    candidate.occurrences += 1;
    candidate.evidence = [...(candidate.evidence || []), evidence].slice(-MAX_CANDIDATE_EVIDENCE);
  } else {
    const applied = [...store.items]
      .reverse()
      .find((item) => item.fingerprint === fingerprint && item.status === "applied");
    candidate = {
      id: `cand-${fingerprint.slice(0, 12)}-${crypto.randomBytes(3).toString("hex")}`,
      fingerprint,
      status: "candidate",
      kind: applied ? "regression" : signal.kind,
      summary: signal.summary,
      scope: signal.scope,
      first_seen: timestamp,
      last_seen: timestamp,
      occurrences: 1,
      evidence: [evidence],
      reviews: [],
    };
    if (applied) {
      candidate.regression_of = applied.id;
    }
    store.items.push(candidate);
  }
  store.updated_at = timestamp;
  return candidate;
}

function buildActiveRuleProjection(candidateStore) {
  return {
    schema_version: SELF_IMPROVEMENT_SCHEMA_VERSION,
    generated_from: "candidates.json",
    updated_at: candidateStore.updated_at,
    items: candidateStore.items
      .filter((candidate) => candidate.status === "applied")
      .map((candidate) => ({
        id: `rule-${candidate.id.slice(5)}`,
        candidate_id: candidate.id,
        status: "applied",
        kind: candidate.kind,
        rule: candidate.summary,
        scope: candidate.scope,
        validation: candidate.validation,
        owner: candidate.application && candidate.application.owner,
        change_ref: candidate.application && candidate.application.change_ref,
        evidence_count: candidate.occurrences,
        applied_at: candidate.application && candidate.application.applied_at,
      })),
  };
}

function writeActiveRuleProjection(filePath, candidateStore) {
  const projection = buildActiveRuleProjection(candidateStore);
  if (!projection.items.length && !fs.existsSync(filePath)) {
    return;
  }
  writeJsonAtomic(filePath, projection);
}

function buildBehaviorInbox(candidateStore) {
  const attentionRank = { urgent: 4, high: 3, medium: 2, normal: 1 };
  const nextAction = {
    candidate: "run-eval",
    validated: "create-proposal",
    applied: "monitor",
    rejected: "none",
    superseded: "none",
    rolled_back: "investigate-regression",
  };
  return [...(candidateStore.items || [])]
    .map((candidate) => {
      let attention = "normal";
      if (candidate.kind === "regression") {
        attention = "urgent";
      } else if (candidate.occurrences >= 3) {
        attention = "high";
      } else if (candidate.occurrences >= 2) {
        attention = "medium";
      }
      return {
        id: candidate.id,
        status: candidate.status,
        kind: candidate.kind,
        summary: candidate.summary,
        occurrences: candidate.occurrences,
        attention,
        next_action: nextAction[candidate.status] || "review",
        regression_of: candidate.regression_of || null,
        last_seen: candidate.last_seen || null,
      };
    })
    .sort((left, right) => {
      const attentionDelta = attentionRank[right.attention] - attentionRank[left.attention];
      if (attentionDelta) {
        return attentionDelta;
      }
      const occurrenceDelta = (right.occurrences || 0) - (left.occurrences || 0);
      if (occurrenceDelta) {
        return occurrenceDelta;
      }
      return String(right.last_seen || "").localeCompare(String(left.last_seen || ""));
    });
}

module.exports = {
  SELF_IMPROVEMENT_SCHEMA_VERSION,
  buildActiveRuleProjection,
  buildBehaviorInbox,
  loadCandidateStore,
  resolveSelfImprovementEnvironment,
  upsertLearningCandidate,
  writeActiveRuleProjection,
};

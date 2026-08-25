"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const {
  readJsonStrict,
  writeFileAtomic,
  writeJsonAtomic,
  withFileLock,
} = require("./persistence");
const { removeCodexBlock, upsertCodexBlock } = require("./codex-config");
const { collectManagedResources, removeManagedResources } = require("./ownership");
const {
  SELF_IMPROVEMENT_SCHEMA_VERSION,
  buildActiveRuleProjection,
  buildBehaviorInbox,
  loadCandidateStore,
  resolveSelfImprovementEnvironment,
  upsertLearningCandidate,
  writeActiveRuleProjection,
} = require("./self-improvement");
const { loadEvalResult, runEvalArtifact } = require("./eval-runner");
const { resolveOwnerCandidates } = require("./owner-resolver");
const { buildBehaviorProposal } = require("./behavior-proposal");
const { collectHostConformance } = require("./host-conformance");

const PACKAGE_NAME = "@codeharbor/agent-playbook";
const APP_NAME = "agent-playbook";
const SKILLS_DIR_NAME = "skills";
const DEFAULT_SESSION_DIR = "sessions";
const LOCAL_CLI_DIR = "agent-playbook";
const HOOK_SOURCE_VALUE = "agent-playbook";
const STATE_FILE_NAME = "state.json";
const DISABLED_DIR_NAME = ".disabled";
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_SKILL_SCOPES = new Set(["project", "global"]);
const VALID_SKILL_TARGETS = new Set(["claude", "codex", "gemini", "dsh"]);
const VALID_INSTALL_MODES = new Set(["link", "copy"]);

const packageJson = readJsonSafe(path.join(__dirname, "..", "package.json"));
const VERSION = (packageJson && packageJson.version) || "0.0.0";

function main(argv, context) {
  const parsed = parseArgs(argv);
  const command = parsed.command || "help";
  const options = parsed.options;

  switch (command) {
    case "init":
      return handleInit(options, context);
    case "status":
      return handleStatus(options, context);
    case "doctor":
      return handleDoctor(options, context);
    case "conformance":
      return handleConformance(options, context);
    case "repair":
      return handleRepair({ ...options, repair: true }, context);
    case "uninstall":
      return handleUninstall(options, context);
    case "session-log":
      return handleSessionLog(options);
    case "self-improve":
      return handleSelfImprove(options, parsed.positionals);
    case "behavior":
      return handleSelfImprove(options, parsed.positionals, "inbox");
    case "skills":
      return handleSkills(options, parsed.positionals, context);
    case "upgrade":
      return handleUpgrade(options, context);
    case "help":
    case "--help":
    case "-h":
    default:
      printHelp();
      return Promise.resolve();
  }
}

function printHelp() {
  const text = [
    `${APP_NAME} ${VERSION}`,
    "",
    "Usage:",
    `  ${APP_NAME} init [--project] [--copy] [--overwrite] [--hooks] [--no-hooks] [--session-dir <path>] [--dry-run] [--repo <path>]`,
    `  ${APP_NAME} status [--project] [--repo <path>]`,
    `  ${APP_NAME} doctor [--project] [--repo <path>]`,
    `  ${APP_NAME} conformance [--project] [--repo <path>] [--format json]`,
    `  ${APP_NAME} repair [--project] [--overwrite] [--hooks] [--no-hooks] [--repo <path>]`,
    `  ${APP_NAME} uninstall [--project] [--repo <path>]`,
    `  ${APP_NAME} skills [list|info|add|remove|enable|disable|doctor|sync|upgrade|export|import]`,
    `  ${APP_NAME} behavior [inbox|capture|owners|eval|review|proposal|export]`,
    "",
    "Fresh installs leave Claude hooks disabled; pass --hooks to opt in.",
    "--session-dir requires hooks to be enabled.",
    "",
    "Hook commands:",
    `  ${APP_NAME} session-log [--session-dir <path>]`,
    `  ${APP_NAME} self-improve [capture] [--kind <kind>] [--summary <text>] [--evidence <text>]`,
    `  ${APP_NAME} self-improve list [--status <status>] [--format json]`,
    `  ${APP_NAME} self-improve eval <candidate-id> --artifact <eval.json> [--format json]`,
    `  ${APP_NAME} self-improve review <candidate-id> --decision <validate|apply|observe|reject|supersede|rollback> --reason <text>`,
    `    validate also requires --eval-result <result.json> from self-improve eval`,
    `    apply also requires --owner <durable-owner> --change-ref <reference>`,
    `  ${APP_NAME} self-improve export --output <markdown-file>`,
    `  ${APP_NAME} behavior inbox [--status <status>] [--format json]`,
    `  ${APP_NAME} behavior owners <candidate-id> [--repo <path>] [--format json]`,
    `  ${APP_NAME} behavior proposal <candidate-id> --owner <durable-owner> --output <markdown-file>`,
    "",
    "Other commands:",
    `  ${APP_NAME} upgrade`,
  ];
  console.log(text.join("\n"));
}

function parseArgs(argv) {
  const valueFlags = new Set([
    "session-dir",
    "repo",
    "transcript-path",
    "cwd",
    "hook-source",
    "scope",
    "target",
    "format",
    "source",
    "output",
    "data-dir",
    "kind",
    "summary",
    "evidence",
    "status",
    "decision",
    "reason",
    "owner",
    "change-ref",
    "artifact",
    "eval-result",
  ]);
  const options = {};
  const positionals = [];
  let command = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!command && !arg.startsWith("-")) {
      command = arg;
      continue;
    }

    if (arg.startsWith("--no-")) {
      const key = arg.slice(5);
      options[key] = false;
      continue;
    }

    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      const key = eqIndex === -1 ? arg.slice(2) : arg.slice(2, eqIndex);
      const hasValue = eqIndex !== -1;

      if (hasValue) {
        options[key] = arg.slice(eqIndex + 1);
        continue;
      }

      if (valueFlags.has(key)) {
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          options[key] = next;
          i += 1;
        } else {
          options[key] = "";
        }
        continue;
      }

      options[key] = true;
      continue;
    }

    positionals.push(arg);
  }

  return { command, options, positionals };
}

function handleInit(options, context) {
  const settings = resolveSettings(options, context);
  const repoRoot = settings.repoRoot;
  const warnings = [];
  const overwriteState = createOverwriteState(options);
  const manifestPath = path.join(settings.claudeSkillsDir, ".agent-playbook.json");
  const previousManifest = readJsonStrict(manifestPath, null);
  const hooksEnabled = resolveHooksEnabled(options, settings.claudeSettingsPath);
  assertSessionDirRequiresHooks(options, hooksEnabled);
  assertCodexConfigReadable(settings);
  if (hooksEnabled || options.hooks === false) {
    assertClaudeSettingsReadable(settings);
  }

  if (!settings.skillsSource) {
    if (options.repair) {
      warnings.push("Skills directory not found; skipping skill linking.");
    } else {
      throw new Error("Unable to locate skills directory. Run from the agent-playbook repo or pass --repo.");
    }
  }

  ensureDir(settings.claudeSkillsDir, options["dry-run"]);
  ensureDir(settings.codexSkillsDir, options["dry-run"]);
  ensureDir(settings.geminiSkillsDir, options["dry-run"]);
  ensureDir(settings.dshSkillsDir, options["dry-run"]);

  const manifest = {
    name: APP_NAME,
    version: VERSION,
    installedAt: new Date().toISOString(),
    repoRoot,
    copyMode: Boolean(options.copy),
    hooksEnabled,
    links: {
      claude: [],
      codex: [],
      gemini: [],
      dsh: [],
    },
  };

  let claudeLinks = { created: [], skipped: [] };
  let codexLinks = { created: [], skipped: [] };
  let geminiLinks = { created: [], skipped: [] };
  let dshLinks = { created: [], skipped: [] };
  if (settings.skillsSource) {
    claudeLinks = linkSkills(settings.skillsSource, settings.claudeSkillsDir, options, overwriteState);
    codexLinks = linkSkills(settings.skillsSource, settings.codexSkillsDir, options, overwriteState);
    geminiLinks = linkSkills(settings.skillsSource, settings.geminiSkillsDir, options, overwriteState);
    dshLinks = linkSkills(settings.skillsSource, settings.dshSkillsDir, options, overwriteState);
    const previousLinks = previousManifest && previousManifest.links ? previousManifest.links : {};
    manifest.links.claude = collectManagedResources(
      previousLinks.claude,
      claudeLinks,
      settings.claudeSkillsDir
    );
    manifest.links.codex = collectManagedResources(
      previousLinks.codex,
      codexLinks,
      settings.codexSkillsDir
    );
    manifest.links.gemini = collectManagedResources(
      previousLinks.gemini,
      geminiLinks,
      settings.geminiSkillsDir
    );
    manifest.links.dsh = collectManagedResources(
      previousLinks.dsh,
      dshLinks,
      settings.dshSkillsDir
    );

    if (!options["dry-run"]) {
      writeJsonAtomic(manifestPath, manifest);
    }
  }

  if (hooksEnabled) {
    const hookCommandPath = ensureLocalCli(settings, context, options);
    const hookUpdated = updateClaudeSettings(settings, hookCommandPath, options);
    if (hookUpdated === false) {
      warnings.push("Unable to update Claude settings (invalid JSON).");
    }
  } else if (options.hooks === false) {
    removeHooks(settings);
    removeLocalCli(settings);
  }

  updateCodexConfig(settings, options);

  printInitSummary(
    settings,
    hooksEnabled,
    options,
    claudeLinks,
    codexLinks,
    geminiLinks,
    dshLinks,
    warnings
  );
  return Promise.resolve();
}

function handleStatus(options, context) {
  const settings = resolveSettings(options, context || {});
  const status = collectStatus(settings);
  printStatus(status);
  return Promise.resolve();
}

function handleDoctor(options, context) {
  const settings = resolveSettings(options, context || {});
  const status = collectStatus(settings);
  const issues = summarizeIssues(status);

  printStatus(status);
  if (issues.length) {
    console.error("\nIssues detected:");
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("\nNo critical issues detected.");
  }

  return Promise.resolve();
}

function handleConformance(options, context) {
  const settings = resolveSettings(options, context || {});
  const status = collectStatus(settings);
  const manifest = readJsonSafe(
    path.join(settings.claudeSkillsDir, ".agent-playbook.json")
  );
  const report = collectHostConformance({
    packageVersion: VERSION,
    skillsSource: settings.skillsSource,
    hosts: {
      claude: {
        skillsDir: settings.claudeSkillsDir,
        expectedSkills: getManifestSkillNames(manifest, "claude"),
        manifestPresent: status.manifestPresent,
        manifestReadable: status.manifestReadable,
        settingsPath: settings.claudeSettingsPath,
        localCliPath: path.join(
          settings.claudeDir,
          LOCAL_CLI_DIR,
          "bin",
          "agent-playbook.js"
        ),
      },
      codex: {
        skillsDir: settings.codexSkillsDir,
        expectedSkills: getManifestSkillNames(manifest, "codex"),
        metadataPresent: status.codexBlockPresent,
      },
      gemini: {
        skillsDir: settings.geminiSkillsDir,
        expectedSkills: getManifestSkillNames(manifest, "gemini"),
      },
      dsh: {
        skillsDir: settings.dshSkillsDir,
        expectedSkills: getManifestSkillNames(manifest, "dsh"),
      },
    },
  });

  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printConformance(report);
  }
  if (report.overall !== "pass") {
    process.exitCode = 1;
  }
  return Promise.resolve();
}

function getManifestSkillNames(manifest, host) {
  const entries = manifest?.links?.[host];
  if (!Array.isArray(entries)) {
    return [];
  }
  return uniqueList(
    entries
      .map((entry) => path.basename(String(entry?.target || "")))
      .filter((name) => SKILL_NAME_PATTERN.test(name))
  ).sort();
}

function handleUninstall(options, context) {
  const settings = resolveSettings(options, context || {});
  const manifestPath = path.join(settings.claudeSkillsDir, ".agent-playbook.json");
  const manifest = readJsonStrict(manifestPath, null);
  assertCodexConfigReadable(settings);
  if (!manifest || manifest.hooksEnabled !== false) {
    assertClaudeSettingsReadable(settings);
  }

  if (manifest && manifest.links) {
    const results = [
      removeManagedResources(manifest.links.claude || [], settings.claudeSkillsDir),
      removeManagedResources(manifest.links.codex || [], settings.codexSkillsDir),
      removeManagedResources(manifest.links.gemini || [], settings.geminiSkillsDir),
      removeManagedResources(manifest.links.dsh || [], settings.dshSkillsDir),
    ];
    results.flatMap((result) => result.preserved).forEach((target) => {
      console.error(`Warning: ownership changed for ${target}; preserving it.`);
    });
    safeUnlink(manifestPath);
  } else {
    console.log("No manifest found. Skipping link removal.");
  }

  removeHooks(settings);
  removeCodexConfig(settings);
  removeLocalCli(settings);
  console.log("Uninstall complete.");
  return Promise.resolve();
}

async function handleSessionLog(options) {
  const input = await readStdinJson();
  const transcriptPath = options["transcript-path"] || input.transcript_path;
  const cwd = options.cwd || input.cwd || process.cwd();
  const sessionId = input.session_id || "unknown";
  const projectRoot = findRepoRoot(cwd) || cwd;
  const projectId = createProjectId(projectRoot);
  const configuredRoot = options["data-dir"] || process.env.AGENT_PLAYBOOK_DATA_DIR;
  const dataRoot = configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(os.homedir(), ".agent-playbook");
  const sessionDir = resolveSessionDir(options["session-dir"], dataRoot, projectId);

  ensureDir(sessionDir, false);

  const events = transcriptPath ? readTranscript(transcriptPath) : [];
  const insights = collectTranscriptInsights(events, projectRoot);
  const lastUserPrompt = insights.lastUserPrompt;
  const topic = buildTopic(lastUserPrompt, cwd);
  const fileName = `${formatDate(new Date())}-${topic}.md`;
  const outputPath = resolveUniquePath(path.join(sessionDir, fileName));
  const summary = buildSessionSummary(insights, sessionId, projectId);

  writeFileAtomic(outputPath, summary, { mode: 0o600 });
  console.error(`Session log saved to ${outputPath}`);
}

async function handleSelfImprove(options, positionals, defaultSubcommand = "capture") {
  const subcommand = positionals[0] || defaultSubcommand;
  if (subcommand === "list") {
    return handleSelfImproveList(options);
  }
  if (subcommand === "inbox") {
    return handleBehaviorInbox(options);
  }
  if (subcommand === "review") {
    return handleSelfImproveReview(options, positionals.slice(1));
  }
  if (subcommand === "eval") {
    return handleSelfImproveEval(options, positionals.slice(1));
  }
  if (subcommand === "owners") {
    return handleBehaviorOwners(options, positionals.slice(1));
  }
  if (subcommand === "proposal") {
    return handleBehaviorProposal(options, positionals.slice(1));
  }
  if (subcommand === "export") {
    return handleSelfImproveExport(options);
  }
  if (subcommand !== "capture") {
    console.error(`Unknown self-improve subcommand: ${subcommand}`);
    process.exitCode = 1;
    return;
  }

  const input = await readStdinJson();
  const signal = buildLearningSignal(input, options);
  if (!signal) {
    console.error("No reusable learning signal captured.");
    return;
  }

  const env = resolveSelfImprovementEnvironment(options);
  const now = new Date();
  const candidate = withFileLock(env.lockPath, () => {
    const candidateStore = loadCandidateStore(env.candidatesPath);
    const captured = upsertLearningCandidate(candidateStore, signal, now);
    const event = {
      schema_version: SELF_IMPROVEMENT_SCHEMA_VERSION,
      id: createEventId(now),
      timestamp: now.toISOString(),
      candidate_id: captured.id,
      kind: captured.kind,
      summary: captured.summary,
      evidence: signal.evidence,
      scope: captured.scope,
      source: signal.source,
      agent_playbook_version: VERSION,
    };

    ensureDir(path.join(env.eventsDir, now.toISOString().slice(0, 7)), false);
    writeJsonAtomic(
      path.join(env.eventsDir, now.toISOString().slice(0, 7), `${event.id}.json`),
      event
    );
    writeJsonAtomic(env.candidatesPath, candidateStore);
    writeActiveRuleProjection(env.activeRulesPath, candidateStore);
    return captured;
  });
  console.error(`Learning candidate ${candidate.id} captured (${candidate.occurrences} occurrence(s)).`);
}

async function handleUpgrade(options, context) {
  const { execFileSync } = require("child_process");
  console.log(`Current version: ${VERSION}`);
  console.log(`Checking for updates...`);

  try {
    const latestVersion = execFileSync("npm", ["view", PACKAGE_NAME, "version"], {
      encoding: "utf8",
    }).trim();

    if (latestVersion === VERSION) {
      console.log(`Already at the latest version (${VERSION}); refreshing the hook runtime.`);
      await handleRepair({ ...options, repair: true }, context || {});
      return;
    }

    console.log(`New version available: ${latestVersion}`);
    console.log(`Upgrading ${PACKAGE_NAME}...`);

    execFileSync("npm", ["install", "-g", `${PACKAGE_NAME}@latest`], {
      stdio: "inherit",
    });

    const npmRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    const upgradedBin = path.join(npmRoot, "@codeharbor", "agent-playbook", "bin", "agent-playbook.js");
    if (!fs.existsSync(upgradedBin)) {
      throw new Error(`Upgraded CLI not found at ${upgradedBin}`);
    }
    const repairArgs = [upgradedBin, "repair"];
    if (options.repo) {
      repairArgs.push("--repo", path.resolve(options.repo));
    }
    if (options.project) {
      repairArgs.push("--project");
    }
    if (options["session-dir"]) {
      repairArgs.push("--session-dir", path.resolve(options["session-dir"]));
    }
    if (options.hooks === false) {
      repairArgs.push("--no-hooks");
    } else if (options.hooks === true) {
      repairArgs.push("--hooks");
    }
    execFileSync(process.execPath, repairArgs, { stdio: "inherit", env: process.env });

    console.log(`Successfully upgraded to ${latestVersion} and refreshed the hook runtime.`);
  } catch (error) {
    console.error(`Upgrade failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function buildLearningSignal(input, options) {
  const manualSummary = sanitizeLearningText(options.summary, 240);
  const cwd = input.cwd || process.cwd();
  const toolName = sanitizeLearningText(input.tool_name || "tool", 60);
  const hookEvent = sanitizeLearningText(input.hook_event_name || "manual", 60);
  const rawError = firstNonEmptyValue([
    input.error,
    input.tool_error,
    input.tool_response && input.tool_response.error,
    input.tool_output && input.tool_output.error,
  ]);
  const isFailure = hookEvent === "PostToolUseFailure" || Boolean(rawError);

  if (!manualSummary && !isFailure) {
    return null;
  }

  const kind = sanitizeLearningKind(options.kind || (isFailure ? "failure" : "observation"));
  const errorSummary = rawError
    ? sanitizeLearningText(valueToText(rawError), 160)
    : "failed without a captured error message";
  const summary = manualSummary || `${toolName} failed: ${errorSummary}`;
  const defaultEvidence = isFailure ? `hook:${hookEvent}:${toolName}` : "manual:capture";
  const projectRoot = findRepoRoot(cwd) || cwd;

  return {
    kind,
    summary,
    evidence: sanitizeLearningText(options.evidence || defaultEvidence, 160),
    scope: createProjectId(projectRoot),
    source: manualSummary ? "manual" : "hook",
  };
}

function sanitizeLearningKind(value) {
  const normalized = slugify(value).slice(0, 40);
  return normalized || "observation";
}

function sanitizeLearningText(value, limit) {
  const text = redactSensitiveText(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimTo(text, limit);
}

function redactSensitiveText(value, projectRoot) {
  let text = valueToText(value);
  if (projectRoot) {
    const normalizedProjectRoot = path.resolve(projectRoot);
    text = text.split(normalizedProjectRoot).join("[PROJECT_ROOT]");
  }
  const homeDir = os.homedir();
  if (homeDir && homeDir !== path.parse(homeDir).root) {
    text = text.split(homeDir).join("~");
  }
  text = text
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/gi, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16})\b/g, "[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\b(api[_-]?key|token|password|passwd|secret|cookie|authorization)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[REDACTED]")
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, "https://[REDACTED]@");
  return text;
}

function valueToText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function firstNonEmptyValue(values) {
  return values.find((value) => value !== undefined && value !== null && valueToText(value).trim());
}

function createEventId(now) {
  return `evt-${now.toISOString()}-${crypto.randomBytes(3).toString("hex")}`.replace(/[:.]/g, "-");
}

function handleSelfImproveList(options) {
  const env = resolveSelfImprovementEnvironment(options);
  const store = loadCandidateStore(env.candidatesPath);
  const status = options.status ? String(options.status).toLowerCase() : "";
  const items = status ? store.items.filter((item) => item.status === status) : store.items;
  if (options.format === "json") {
    console.log(JSON.stringify(items, null, 2));
    return Promise.resolve();
  }
  if (!items.length) {
    console.log("No learning candidates found.");
    return Promise.resolve();
  }
  items.forEach((item) => {
    console.log(`${item.id}\t${item.status}\t${item.occurrences}x\t${item.summary}`);
  });
  return Promise.resolve();
}

function handleBehaviorInbox(options) {
  const env = resolveSelfImprovementEnvironment(options);
  const store = loadCandidateStore(env.candidatesPath);
  const requestedStatus = options.status ? String(options.status).toLowerCase() : "";
  const inbox = buildBehaviorInbox(store).filter(
    (item) => !requestedStatus || item.status === requestedStatus
  );
  if (options.format === "json") {
    console.log(JSON.stringify(inbox, null, 2));
    return Promise.resolve();
  }
  if (!inbox.length) {
    console.log("Behavior inbox is empty.");
    return Promise.resolve();
  }
  inbox.forEach((item) => {
    console.log(
      `${item.attention}\t${item.id}\t${item.status}\t${item.occurrences}x\t${item.next_action}\t${item.summary}`
    );
  });
  return Promise.resolve();
}

function handleBehaviorOwners(options, args) {
  const candidateId = args[0];
  if (!candidateId) {
    console.error("Usage: agent-playbook behavior owners <candidate-id> [--repo <path>]");
    process.exitCode = 1;
    return Promise.resolve();
  }
  const env = resolveSelfImprovementEnvironment(options);
  const store = loadCandidateStore(env.candidatesPath);
  const candidate = store.items.find((item) => item.id === candidateId);
  if (!candidate) {
    console.error(`Learning candidate not found: ${candidateId}`);
    process.exitCode = 1;
    return Promise.resolve();
  }
  const requestedRoot = options.repo ? path.resolve(options.repo) : process.cwd();
  const repoRoot = findRepoRoot(requestedRoot) || requestedRoot;
  let owners;
  try {
    owners = resolveOwnerCandidates({ candidate, repoRoot });
  } catch (error) {
    console.error(`Owner resolution failed: ${error.message}`);
    process.exitCode = 1;
    return Promise.resolve();
  }
  if (options.format === "json") {
    console.log(JSON.stringify(owners, null, 2));
    return Promise.resolve();
  }
  if (!owners.length) {
    console.log("No durable owner candidates found. Choose one explicitly before application.");
    return Promise.resolve();
  }
  owners.forEach((owner) => {
    const matched = owner.matched_terms.length ? owner.matched_terms.join(",") : "-";
    console.log(`${owner.score}\t${owner.owner}\t${owner.type}\t${matched}\t${owner.reason}`);
  });
  return Promise.resolve();
}

function handleBehaviorProposal(options, args) {
  const candidateId = args[0];
  if (!candidateId || !options.owner || !options.output) {
    console.error(
      "Usage: agent-playbook behavior proposal <candidate-id> --owner <durable-owner> --output <markdown-file>"
    );
    process.exitCode = 1;
    return Promise.resolve();
  }
  const env = resolveSelfImprovementEnvironment(options);
  const store = loadCandidateStore(env.candidatesPath);
  const candidate = store.items.find((item) => item.id === candidateId);
  if (!candidate) {
    console.error(`Learning candidate not found: ${candidateId}`);
    process.exitCode = 1;
    return Promise.resolve();
  }
  let markdown;
  try {
    markdown = buildBehaviorProposal(candidate, sanitizeLearningText(options.owner, 160));
  } catch (error) {
    console.error(`Behavior proposal rejected: ${error.message}`);
    process.exitCode = 1;
    return Promise.resolve();
  }
  const outputPath = path.resolve(options.output);
  writeFileAtomic(outputPath, markdown, { mode: 0o600 });
  console.log(`Behavior proposal written to ${outputPath}`);
  return Promise.resolve();
}

function handleSelfImproveEval(options, args) {
  const candidateId = args[0];
  if (!candidateId || !options.artifact) {
    console.error("Usage: agent-playbook self-improve eval <candidate-id> --artifact <eval.json>");
    process.exitCode = 1;
    return Promise.resolve();
  }
  const env = resolveSelfImprovementEnvironment(options);
  const store = loadCandidateStore(env.candidatesPath);
  const candidate = store.items.find((item) => item.id === candidateId);
  if (!candidate) {
    console.error(`Learning candidate not found: ${candidateId}`);
    process.exitCode = 1;
    return Promise.resolve();
  }

  let executed;
  try {
    executed = runEvalArtifact({
      artifactPath: options.artifact,
      candidateId,
      resultDir: env.evalsDir,
    });
  } catch (error) {
    console.error(`Evaluation failed to run: ${error.message}`);
    process.exitCode = 1;
    return Promise.resolve();
  }

  if (options.format === "json") {
    console.log(
      JSON.stringify(
        {
          result_path: executed.resultPath,
          ...executed.result,
        },
        null,
        2
      )
    );
  } else {
    executed.diagnostics.forEach((diagnostic) => {
      console.log(`${diagnostic.passed ? "PASS" : "FAIL"}\t${diagnostic.id}`);
      if (!diagnostic.passed) {
        if (diagnostic.timedOut) {
          console.error(`- ${diagnostic.id}: timed out`);
        } else if (diagnostic.spawnError) {
          console.error(`- ${diagnostic.id}: ${diagnostic.spawnError}`);
        } else {
          console.error(`- ${diagnostic.id}: exit ${diagnostic.exitCode}`);
        }
      }
    });
    console.log(`Eval result: ${executed.resultPath}`);
  }
  if (!executed.result.passed) {
    process.exitCode = 1;
  }
  return Promise.resolve();
}

function handleSelfImproveReview(options, args) {
  const candidateId = args[0];
  const requestedDecision = String(options.decision || "").toLowerCase();
  const decision = requestedDecision === "promote" ? "validate" : requestedDecision;
  const reason = sanitizeLearningText(options.reason, 240);
  const validDecisions = new Set(["validate", "apply", "observe", "reject", "supersede", "rollback"]);
  if (!candidateId || !validDecisions.has(decision) || !reason) {
    console.error(
      "Usage: agent-playbook self-improve review <candidate-id> --decision <validate|apply|observe|reject|supersede|rollback> --reason <text>"
    );
    process.exitCode = 1;
    return Promise.resolve();
  }
  const owner = sanitizeLearningText(options.owner, 160);
  const changeRef = sanitizeLearningText(options["change-ref"], 200);
  if (decision === "apply" && (!owner || !changeRef)) {
    console.error("Application requires --owner <durable-owner> and --change-ref <reference>.");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = resolveSelfImprovementEnvironment(options);
  const result = withFileLock(env.lockPath, () => {
    const store = loadCandidateStore(env.candidatesPath);
    const candidate = store.items.find((item) => item.id === candidateId);
    if (!candidate) {
      return { error: `Learning candidate not found: ${candidateId}` };
    }

    const allowedTransitions = {
      candidate: new Set(["observe", "reject", "validate"]),
      validated: new Set(["observe", "apply", "supersede"]),
      applied: new Set(["rollback", "supersede"]),
      rejected: new Set(),
      superseded: new Set(),
      rolled_back: new Set(),
    };
    const allowed = allowedTransitions[candidate.status] || new Set();
    if (!allowed.has(decision)) {
      return { error: `Invalid transition: ${candidate.status} -> ${decision}.` };
    }

    let evalResult = null;
    if (decision === "validate") {
      if (!options["eval-result"]) {
        return { error: "Validation requires --eval-result <result.json> from self-improve eval." };
      }
      try {
        evalResult = loadEvalResult(options["eval-result"], candidateId, {
          requirePassed: true,
          resultDir: env.evalsDir,
        });
      } catch (error) {
        return { error: `Validation rejected: ${error.message}` };
      }
    }

    const timestamp = new Date().toISOString();
    const review = { decision, reason, timestamp };
    if (decision === "validate") {
      candidate.status = "validated";
      candidate.validation = {
        method: "executable-eval",
        evidence: `sha256:${evalResult.artifact_sha256}`,
        eval_result: {
          id: evalResult.id,
          artifact_sha256: evalResult.artifact_sha256,
          completed_at: evalResult.completed_at,
          summary: evalResult.summary,
        },
        validated_at: timestamp,
      };
      review.validation = candidate.validation;
    } else if (decision === "apply") {
      candidate.status = "applied";
      candidate.application = {
        owner,
        change_ref: changeRef,
        applied_at: timestamp,
      };
      review.application = candidate.application;
    } else if (decision === "reject") {
      candidate.status = "rejected";
    } else if (decision === "supersede") {
      candidate.status = "superseded";
    } else if (decision === "rollback") {
      candidate.status = "rolled_back";
    }
    candidate.reviews = candidate.reviews || [];
    candidate.reviews.push(review);
    candidate.last_reviewed_at = timestamp;
    store.updated_at = timestamp;
    writeJsonAtomic(env.candidatesPath, store);
    writeActiveRuleProjection(env.activeRulesPath, store);
    return { candidate };
  });
  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return Promise.resolve();
  }
  if (requestedDecision === "promote") {
    console.error('Warning: decision "promote" is deprecated; recorded as "validate".');
  }
  console.log(`${result.candidate.id} reviewed: ${decision}.`);
  return Promise.resolve();
}

function handleSelfImproveExport(options) {
  if (!options.output) {
    console.error("Usage: agent-playbook self-improve export --output <markdown-file>");
    process.exitCode = 1;
    return Promise.resolve();
  }
  const env = resolveSelfImprovementEnvironment(options);
  const candidateStore = loadCandidateStore(env.candidatesPath);
  const candidates = candidateStore.items;
  const activeRules = buildActiveRuleProjection(candidateStore).items;
  const outputPath = path.resolve(options.output);
  const lines = [
    "# Agent Playbook Learning",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Applied Rules",
    "",
    ...(activeRules.length
      ? activeRules.map(
          (item) =>
            `- **${item.scope}**: ${item.rule} _(owner: ${item.owner}; change: ${item.change_ref})_`
        )
      : ["- None"]),
    "",
    "## Open Candidates",
    "",
    ...(() => {
      const open = candidates.filter(
        (item) => item.status === "candidate" || item.status === "validated"
      );
      return open.length
        ? open.map((item) => `- \`${item.id}\` (${item.occurrences}x): ${item.summary}`)
        : ["- None"];
    })(),
    "",
  ];
  ensureDir(path.dirname(outputPath), false);
  writeFileAtomic(outputPath, lines.join("\n"));
  console.log(`Learning notebook exported to ${outputPath}`);
  return Promise.resolve();
}

function handleSkills(options, positionals, context) {
  const settings = resolveSettings(options, context || {});
  migrateLegacyStateWithLock(settings.statePath, settings.legacyStatePath);
  const subcommand = positionals[0] || "list";
  const args = positionals.slice(1);
  const dispatch = () => {
    switch (subcommand) {
      case "list":
        return handleSkillsList(options, args, settings);
      case "info":
        return handleSkillsInfo(options, args, settings);
      case "add":
        return handleSkillsAdd(options, args, settings);
      case "remove":
        return handleSkillsRemove(options, args, settings);
      case "enable":
        return handleSkillsEnable(options, args, settings);
      case "disable":
        return handleSkillsDisable(options, args, settings);
      case "doctor":
        return handleSkillsDoctor(options, args, settings);
      case "sync":
        return handleSkillsSync(options, args, settings);
      case "upgrade":
        return handleSkillsUpgrade(options, args, settings);
      case "export":
        return handleSkillsExport(options, args, settings);
      case "import":
        return handleSkillsImport(options, args, settings);
      default:
        console.error(`Unknown skills subcommand: ${subcommand}`);
        process.exitCode = 1;
        return Promise.resolve();
    }
  };

  const mutating =
    new Set(["add", "remove", "enable", "disable", "sync", "upgrade", "import"]).has(
      subcommand
    ) || (subcommand === "doctor" && options.fix);
  if (mutating) {
    return withFileLock(`${settings.statePath}.lock`, dispatch);
  }
  return dispatch();
}

function resolveSettings(options, context) {
  const cwd = process.cwd();
  const repoRootDetected = options.repo ? path.resolve(options.repo) : findRepoRoot(cwd);
  const cliRoot =
    context && context.cliPath ? path.resolve(path.dirname(context.cliPath), "..") : null;
  const skillsSource = resolveSkillsSource([repoRootDetected || cwd, cliRoot]);
  const projectMode = Boolean(options.project);
  const configuredDataRoot = options["data-dir"] || process.env.AGENT_PLAYBOOK_DATA_DIR;
  const dataRoot = configuredDataRoot
    ? path.resolve(configuredDataRoot)
    : path.join(os.homedir(), ".agent-playbook");

  const envClaudeDir = process.env.AGENT_PLAYBOOK_CLAUDE_DIR;
  const envCodexDir = process.env.AGENT_PLAYBOOK_CODEX_DIR;
  const envGeminiDir = process.env.AGENT_PLAYBOOK_GEMINI_DIR;
  const envDshDir = process.env.AGENT_PLAYBOOK_DSH_DIR;
  const globalClaudeDir = envClaudeDir ? path.resolve(envClaudeDir) : path.join(os.homedir(), ".claude");
  const globalCodexDir = envCodexDir ? path.resolve(envCodexDir) : path.join(os.homedir(), ".codex");
  const globalGeminiDir = envGeminiDir ? path.resolve(envGeminiDir) : path.join(os.homedir(), ".gemini");
  const globalDshDir = envDshDir ? path.resolve(envDshDir) : path.join(os.homedir(), ".dsh");
  const projectRoot = repoRootDetected || cwd;
  const projectClaudeDir = repoRootDetected ? path.join(repoRootDetected, ".claude") : null;
  const projectCodexDir = repoRootDetected ? path.join(repoRootDetected, ".codex") : null;
  const projectGeminiDir = repoRootDetected ? path.join(repoRootDetected, ".gemini") : null;
  const projectDshDir = repoRootDetected ? path.join(repoRootDetected, ".dsh") : null;
  const claudeDir = projectMode ? path.join(projectRoot, ".claude") : globalClaudeDir;
  const codexDir = projectMode ? path.join(projectRoot, ".codex") : globalCodexDir;
  const geminiDir = projectMode ? path.join(projectRoot, ".gemini") : globalGeminiDir;
  const dshDir = projectMode ? path.join(projectRoot, ".dsh") : globalDshDir;

  return {
    cwd,
    repoRoot: repoRootDetected || cwd,
    repoRootDetected,
    projectId: createProjectId(projectRoot),
    dataRoot,
    skillsSource,
    projectMode,
    cliPath: context && context.cliPath ? context.cliPath : null,
    claudeDir,
    codexDir,
    geminiDir,
    dshDir,
    globalClaudeDir,
    globalCodexDir,
    globalGeminiDir,
    globalDshDir,
    projectClaudeDir,
    projectCodexDir,
    projectGeminiDir,
    projectDshDir,
    claudeSkillsDir: path.join(claudeDir, SKILLS_DIR_NAME),
    codexSkillsDir: path.join(codexDir, SKILLS_DIR_NAME),
    geminiSkillsDir: path.join(geminiDir, SKILLS_DIR_NAME),
    dshSkillsDir: path.join(dshDir, SKILLS_DIR_NAME),
    claudeSettingsPath: path.join(claudeDir, "settings.json"),
    codexConfigPath: path.join(codexDir, "config.toml"),
    statePath: path.join(dataRoot, STATE_FILE_NAME),
    legacyStatePath: path.join(globalClaudeDir, LOCAL_CLI_DIR, STATE_FILE_NAME),
  };
}

function hashIdentity(value) {
  return crypto.createHash("sha256").update(String(value || "unknown")).digest("hex").slice(0, 12);
}

function createProjectId(projectRoot) {
  let canonical = path.resolve(projectRoot || process.cwd());
  try {
    canonical = fs.realpathSync(canonical);
  } catch (error) {
    // The caller may be preparing a new project path. The normalized absolute path is stable enough.
  }
  return `project-${hashIdentity(canonical)}`;
}

function findRepoRoot(startDir) {
  let current = startDir;
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function findSkillsSource(startDir) {
  let current = startDir;
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, SKILLS_DIR_NAME);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const routerPath = path.join(candidate, "skill-router", "SKILL.md");
      if (fs.existsSync(routerPath)) {
        return candidate;
      }
    }
    current = path.dirname(current);
  }
  return null;
}

function resolveSkillsSource(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const found = findSkillsSource(candidate);
    if (found) {
      return found;
    }
  }
  return null;
}

function createOverwriteState(options) {
  return {
    decision: options.overwrite === true ? true : null,
    prompted: false,
    nonInteractive: false,
  };
}

function promptYesNo(question, defaultYes) {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  process.stdout.write(`${question} ${suffix} `);
  let answer = "";
  try {
    answer = readLineSync().toLowerCase();
  } catch (error) {
    if (error && error.code === "EAGAIN") {
      console.error("Warning: unable to read prompt input; skipping overwrite.");
      return defaultYes;
    }
    throw error;
  }
  if (!answer) {
    return defaultYes;
  }
  return answer === "y" || answer === "yes";
}

function readLineSync() {
  const buffer = Buffer.alloc(1024);
  let input = "";
  const ttyPath = process.platform === "win32" ? null : "/dev/tty";
  let fd = 0;
  let shouldClose = false;

  if (ttyPath) {
    try {
      fd = fs.openSync(ttyPath, "r");
      shouldClose = true;
    } catch (error) {
      fd = 0;
    }
  }

  try {
    while (true) {
      let bytes = 0;
      try {
        bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      } catch (error) {
        throw error;
      }
      if (bytes <= 0) {
        break;
      }
      input += buffer.toString("utf8", 0, bytes);
      if (input.includes("\n")) {
        break;
      }
    }
  } finally {
    if (shouldClose) {
      try {
        fs.closeSync(fd);
      } catch (error) {
        // Best-effort close; ignore failures.
      }
    }
  }
  return input.trim();
}

function shouldOverwriteExisting(options, state, targetPath) {
  if (options.overwrite) {
    state.decision = true;
    return true;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    state.nonInteractive = true;
    return false;
  }
  if (state.decision !== null) {
    return state.decision;
  }
  state.prompted = true;
  state.decision = promptYesNo(
    `Existing skill found at ${targetPath}. Overwrite all existing skills?`,
    false
  );
  return state.decision;
}

function linkSkills(sourceDir, targetDir, options, overwriteState) {
  const created = [];
  const skipped = [];
  const overwritten = [];
  const state = overwriteState || createOverwriteState(options);
  const installMode = resolveInstallMode(options, "link");
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  entries.forEach((entry) => {
    if (!entry.isDirectory()) {
      return;
    }
    if (entry.name.startsWith(".")) {
      return;
    }

    const skillDir = path.join(sourceDir, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      return;
    }

    const targetPath = path.join(targetDir, entry.name);
    if (fs.existsSync(targetPath)) {
      if (isSameLink(targetPath, skillDir)) {
        skipped.push({ source: skillDir, target: targetPath, reason: "already linked" });
        return;
      }
      if (!shouldOverwriteExisting(options, state, targetPath)) {
        skipped.push({ source: skillDir, target: targetPath, reason: "exists" });
        return;
      }
      overwritten.push({ source: skillDir, target: targetPath });
      if (!options["dry-run"]) {
        safeUnlink(targetPath);
      }
    }

    if (options["dry-run"]) {
      created.push({ source: skillDir, target: targetPath, mode: installMode, dryRun: true });
      return;
    }

    if (installMode === "copy") {
      fs.cpSync(skillDir, targetPath, { recursive: true });
      created.push({ source: skillDir, target: targetPath, mode: "copy" });
      return;
    }

    const linkType = process.platform === "win32" ? "junction" : "dir";
    try {
      fs.symlinkSync(skillDir, targetPath, linkType);
      created.push({ source: skillDir, target: targetPath, mode: "link" });
    } catch (error) {
      fs.cpSync(skillDir, targetPath, { recursive: true });
      created.push({ source: skillDir, target: targetPath, mode: "copy", fallback: "symlink_failed" });
    }
  });

  return { created, skipped, overwritten };
}

function buildSkillEnvironment(settings) {
  const projectRoot = settings.repoRootDetected;
  const scopeDirs = {
    project: projectRoot
      ? {
          claude: path.join(projectRoot, ".claude", SKILLS_DIR_NAME),
          codex: path.join(projectRoot, ".codex", SKILLS_DIR_NAME),
          gemini: path.join(projectRoot, ".gemini", SKILLS_DIR_NAME),
          dsh: path.join(projectRoot, ".dsh", SKILLS_DIR_NAME),
        }
      : null,
    global: {
      claude: path.join(settings.globalClaudeDir, SKILLS_DIR_NAME),
      codex: path.join(settings.globalCodexDir, SKILLS_DIR_NAME),
      gemini: path.join(settings.globalGeminiDir, SKILLS_DIR_NAME),
      dsh: path.join(settings.globalDshDir, SKILLS_DIR_NAME),
    },
  };

  return {
    projectRoot,
    projectId: settings.projectId,
    scopeDirs,
    statePath: settings.statePath,
    stateLockPath: `${settings.statePath}.lock`,
    legacyStatePath: settings.legacyStatePath,
    skillsSource: settings.skillsSource,
  };
}

function migrateLegacyStateWithLock(statePath, legacyStatePath) {
  if (fs.existsSync(statePath) || !legacyStatePath || !fs.existsSync(legacyStatePath)) {
    return;
  }
  withFileLock(`${statePath}.lock`, () => migrateLegacyState(statePath, legacyStatePath));
}

function migrateLegacyState(statePath, legacyStatePath) {
  if (
    !legacyStatePath ||
    path.resolve(statePath) === path.resolve(legacyStatePath) ||
    fs.existsSync(statePath) ||
    !fs.existsSync(legacyStatePath)
  ) {
    return;
  }
  const legacy = readJsonStrict(legacyStatePath, null);
  if (!legacy || !Array.isArray(legacy.skills)) {
    const error = new Error(`Invalid legacy state schema in ${legacyStatePath}; migration stopped.`);
    error.code = "APB_INVALID_LEGACY_STATE";
    throw error;
  }
  const migrated = createEmptyState();
  migrated.migrated_from = "claude-agent-playbook-state-v1";
  migrated.skills = legacy.skills.map(normalizeStateEntry).filter(Boolean);
  writeJsonAtomic(statePath, migrated);
}

function normalizeScopeList(scopeValue, projectRoot, defaultScope) {
  const warnings = [];
  const value = String(scopeValue || defaultScope || "both").toLowerCase();
  let scopes = [];
  if (value === "both" || value === "all") {
    scopes = ["project", "global"];
  } else if (value === "project" || value === "repo") {
    scopes = ["project"];
  } else if (value === "global") {
    scopes = ["global"];
  } else {
    const error = new Error(`Unknown scope "${scopeValue}". Expected project, global, or all.`);
    error.code = "APB_INVALID_SCOPE";
    throw error;
  }

  if (!projectRoot) {
    if (scopes.includes("project")) {
      if (scopeValue && value !== "both" && value !== "all") {
        const error = new Error("Project scope requested but no repository root was detected.");
        error.code = "APB_PROJECT_SCOPE_UNAVAILABLE";
        throw error;
      }
      warnings.push("Project scope unavailable; showing global scope only.");
    }
    scopes = scopes.filter((scope) => scope !== "project");
  }

  if (!scopes.length) {
    scopes = ["global"];
  }

  return { scopes, warnings };
}

function normalizeTargetList(targetValue, defaultTarget) {
  const warnings = [];
  const value = String(targetValue || defaultTarget || "both").toLowerCase();
  let targets = [];
  if (value === "both" || value === "all") {
    targets = ["claude", "codex", "gemini", "dsh"];
  } else if (
    value === "claude" ||
    value === "codex" ||
    value === "gemini" ||
    value === "dsh" ||
    value === "deepseek"
  ) {
    if (value === "deepseek") {
      targets = ["dsh"];
    } else {
      targets = [value];
    }
  } else {
    const error = new Error(
      `Unknown target "${targetValue}". Expected claude, codex, gemini, deepseek, or all.`
    );
    error.code = "APB_INVALID_TARGET";
    throw error;
  }
  return { targets, warnings };
}

function isValidSkillName(name) {
  return SKILL_NAME_PATTERN.test(String(name || ""));
}

function resolveInside(rootPath, ...segments) {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, ...segments);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return target;
}

function resolveInstallMode(options, fallbackMode) {
  if (options && options.link) {
    return "link";
  }
  if (options && options.copy) {
    return "copy";
  }
  return fallbackMode || "link";
}

function createEmptyState() {
  return {
    version: "2",
    updated_at: new Date().toISOString(),
    skills: [],
  };
}

function normalizeStateEntry(entry) {
  if (
    !entry ||
    !isValidSkillName(entry.name) ||
    !VALID_SKILL_SCOPES.has(entry.scope) ||
    !VALID_SKILL_TARGETS.has(entry.target)
  ) {
    return null;
  }

  const normalized = { ...entry };
  normalized.project_id =
    normalized.scope === "project" ? normalized.project_id || "legacy-unknown" : "global";
  if (normalized.mode && !VALID_INSTALL_MODES.has(normalized.mode)) {
    delete normalized.mode;
  }
  return normalized;
}

function loadStateFile(statePath) {
  const parsed = readJsonStrict(statePath, null);
  if (!parsed) {
    return createEmptyState();
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.skills)) {
    const error = new Error(`Invalid state schema in ${statePath}; refusing to overwrite it.`);
    error.code = "APB_INVALID_STATE_SCHEMA";
    throw error;
  }
  parsed.skills = parsed.skills.map(normalizeStateEntry).filter(Boolean);
  parsed.version = "2";
  parsed.updated_at = parsed.updated_at || new Date().toISOString();
  return parsed;
}

function saveStateFile(statePath, state, dryRun) {
  if (dryRun) {
    return;
  }
  ensureDir(path.dirname(statePath), false);
  writeJsonAtomic(statePath, state);
}

function stateKey(name, scope, target, projectId) {
  const ownerId = scope === "project" ? projectId || "legacy-unknown" : "global";
  return `${ownerId}:${target}:${scope}:${name}`;
}

function indexStateEntries(state) {
  const map = new Map();
  (state.skills || []).forEach((entry) => {
    if (!normalizeStateEntry(entry)) {
      return;
    }
    map.set(stateKey(entry.name, entry.scope, entry.target, entry.project_id), entry);
  });
  return map;
}

function isStateEntryInEnvironment(entry, env) {
  return entry.scope === "global" || entry.project_id === env.projectId;
}

function listBuiltInSkills(skillsSource) {
  if (!skillsSource || !fs.existsSync(skillsSource)) {
    return [];
  }
  return fs
    .readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(skillsSource, name, "SKILL.md")))
    .sort();
}

function resolveSkillInput(input, env) {
  if (!input) {
    return { error: "Missing skill name or path." };
  }

  const resolvedPath = path.resolve(input);
  if (fs.existsSync(resolvedPath)) {
    const stat = fs.statSync(resolvedPath);
    const skillDir = stat.isDirectory() ? resolvedPath : path.dirname(resolvedPath);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      return { error: `SKILL.md not found in ${skillDir}` };
    }
    const name = path.basename(skillDir);
    if (!isValidSkillName(name)) {
      return { error: `Invalid skill name "${name}". Use lowercase kebab-case.` };
    }
    return { name, sourceDir: skillDir, kind: "path" };
  }

  const skillsSource = env.skillsSource;
  if (!skillsSource) {
    return { error: "No bundled skills directory found. Use a local path instead." };
  }

  if (!isValidSkillName(input)) {
    return { error: `Invalid skill name "${input}". Use lowercase kebab-case.` };
  }

  const candidate = resolveInside(skillsSource, input);
  if (!candidate) {
    return { error: `Invalid skill name "${input}". Use lowercase kebab-case.` };
  }
  if (!fs.existsSync(path.join(candidate, "SKILL.md"))) {
    const available = listBuiltInSkills(skillsSource);
    const sample = available.length ? ` Available: ${available.join(", ")}` : "";
    return { error: `Skill "${input}" not found in bundled skills.${sample}` };
  }

  return { name: input, sourceDir: candidate, kind: "name" };
}

function scanSkills(scopeDirs, scopes, targets, stateIndex, projectId) {
  const records = [];
  const warnings = [];

  scopes.forEach((scope) => {
    const dirs = scopeDirs[scope];
    if (!dirs) {
      warnings.push(`Scope "${scope}" not available.`);
      return;
    }
    targets.forEach((target) => {
      const dirPath = dirs[target];
      if (!dirPath) {
        warnings.push(`Target "${target}" not available for scope "${scope}".`);
        return;
      }
      records.push(...scanSkillDir(dirPath, scope, target, stateIndex, projectId));
    });
  });

  markDuplicates(records);
  return { records, warnings };
}

function scanSkillDir(dirPath, scope, target, stateIndex, projectId) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }

  const records = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const disabledDir = path.join(dirPath, DISABLED_DIR_NAME);

  entries.forEach((entry) => {
    if (entry.name.startsWith(".") || entry.name === DISABLED_DIR_NAME) {
      return;
    }
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      return;
    }
    records.push(
      buildSkillRecord(
        entry.name,
        path.join(dirPath, entry.name),
        scope,
        target,
        false,
        stateIndex,
        projectId
      )
    );
  });

  if (fs.existsSync(disabledDir)) {
    const disabledEntries = fs.readdirSync(disabledDir, { withFileTypes: true });
    disabledEntries.forEach((entry) => {
      if (entry.name.startsWith(".")) {
        return;
      }
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        return;
      }
      records.push(
        buildSkillRecord(
          entry.name,
          path.join(disabledDir, entry.name),
          scope,
          target,
          true,
          stateIndex,
          projectId
        )
      );
    });
  }

  return records;
}

function buildSkillRecord(name, entryPath, scope, target, disabled, stateIndex, projectId) {
  const record = {
    name,
    scope,
    target,
    path: entryPath,
    mode: "unknown",
    status: "ok",
    disabled: Boolean(disabled),
    managed: false,
    source: "",
    duplicate: false,
  };

  try {
    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink()) {
      record.mode = "link";
      try {
        record.source = fs.realpathSync(entryPath);
      } catch (error) {
        record.status = "broken";
      }
    } else if (stat.isDirectory()) {
      record.mode = "copy";
    } else {
      record.status = "missing";
    }
  } catch (error) {
    record.status = "missing";
  }

  if (record.status === "ok") {
    const skillFile = path.join(entryPath, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      record.status = "missing-skill-file";
    }
  }

  if (record.disabled) {
    record.status = "disabled";
  }

  if (stateIndex) {
    const entry = stateIndex.get(stateKey(name, scope, target, projectId));
    if (entry) {
      record.managed = true;
      if (entry.source && !record.source) {
        record.source = entry.source;
      }
      if (entry.mode && record.mode === "unknown") {
        record.mode = entry.mode;
      }
    }
  }

  return record;
}

function markDuplicates(records) {
  const counts = new Map();
  records.forEach((record) => {
    const key = `${record.target}:${record.name}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  records.forEach((record) => {
    const key = `${record.target}:${record.name}`;
    if (counts.get(key) > 1) {
      record.duplicate = true;
    }
  });
}

function formatSkillStatus(record) {
  const tags = [];
  if (record.status && record.status !== "ok") {
    tags.push(record.status);
  }
  if (record.duplicate) {
    tags.push("duplicate");
  }
  if (!tags.length) {
    tags.push("ok");
  }
  return tags.join(",");
}

function printSkillList(records, format) {
  const isJson = String(format || "").toLowerCase() === "json";
  if (!records.length) {
    if (isJson) {
      console.log("[]");
      return;
    }
    console.log("No skills found.");
    return;
  }

  const sorted = [...records].sort((a, b) => {
    if (a.name !== b.name) {
      return a.name.localeCompare(b.name);
    }
    if (a.target !== b.target) {
      return a.target.localeCompare(b.target);
    }
    return a.scope.localeCompare(b.scope);
  });

  if (isJson) {
    console.log(JSON.stringify(sorted, null, 2));
    return;
  }

  const headers = ["Name", "Target", "Scope", "Mode", "Status", "Managed", "Source", "Path"];
  const rows = sorted.map((record) => [
    record.name,
    record.target,
    record.scope,
    record.mode,
    formatSkillStatus(record),
    record.managed ? "yes" : "no",
    record.source || "-",
    record.path,
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length))
  );

  const formatRow = (row) =>
    row
      .map((cell, index) => {
        const value = String(cell);
        return index === row.length - 1 ? value : value.padEnd(widths[index]);
      })
      .join("  ");

  console.log(formatRow(headers));
  console.log(formatRow(headers.map((header) => "-".repeat(header.length))));
  rows.forEach((row) => console.log(formatRow(row)));
}

function resolveSkillMatches(name, options, env, stateIndex, defaultScope) {
  const scopeInfo = normalizeScopeList(options.scope, env.projectRoot, defaultScope || "both");
  const targetInfo = normalizeTargetList(options.target, "both");
  const scan = scanSkills(
    env.scopeDirs,
    scopeInfo.scopes,
    targetInfo.targets,
    stateIndex,
    env.projectId
  );
  const matches = scan.records.filter((record) => record.name === name);
  return { matches, scopeInfo, targetInfo, warnings: [...scopeInfo.warnings, ...targetInfo.warnings] };
}

function installSkill(sourceDir, targetPath, installOptions) {
  const mode = installOptions && installOptions.mode ? installOptions.mode : "link";
  const dryRun = installOptions && installOptions.dryRun;
  const overwrite = installOptions && installOptions.overwrite;

  if (overwrite && fs.existsSync(targetPath)) {
    if (!dryRun) {
      safeUnlink(targetPath);
    }
  }

  if (dryRun) {
    return { mode, dryRun: true };
  }

  ensureDir(path.dirname(targetPath), false);

  if (mode === "copy") {
    fs.cpSync(sourceDir, targetPath, { recursive: true });
    return { mode: "copy" };
  }

  const linkType = process.platform === "win32" ? "junction" : "dir";
  try {
    fs.symlinkSync(sourceDir, targetPath, linkType);
    return { mode: "link" };
  } catch (error) {
    fs.cpSync(sourceDir, targetPath, { recursive: true });
    return { mode: "copy", fallback: "symlink_failed" };
  }
}

function handleSkillsList(options, args, settings) {
  const env = buildSkillEnvironment(settings);
  const scopeInfo = normalizeScopeList(options.scope, env.projectRoot, "both");
  const targetInfo = normalizeTargetList(options.target, "both");
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);

  const scan = scanSkills(
    env.scopeDirs,
    scopeInfo.scopes,
    targetInfo.targets,
    stateIndex,
    env.projectId
  );
  [...scopeInfo.warnings, ...targetInfo.warnings, ...scan.warnings].forEach((warning) =>
    console.error(`Warning: ${warning}`)
  );
  printSkillList(scan.records, options.format);
  return Promise.resolve();
}

function handleSkillsInfo(options, args, settings) {
  const name = args[0];
  if (!name) {
    console.error("Usage: agent-playbook skills info <name>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const scopeInfo = normalizeScopeList(options.scope, env.projectRoot, "both");
  const targetInfo = normalizeTargetList(options.target, "both");
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);
  const scan = scanSkills(
    env.scopeDirs,
    scopeInfo.scopes,
    targetInfo.targets,
    stateIndex,
    env.projectId
  );
  [...scopeInfo.warnings, ...targetInfo.warnings, ...scan.warnings].forEach((warning) =>
    console.error(`Warning: ${warning}`)
  );

  const matches = scan.records.filter((record) => record.name === name);
  if (!matches.length) {
    console.error(`Skill not found: ${name}`);
    process.exitCode = 1;
    return Promise.resolve();
  }

  printSkillList(matches, options.format);
  return Promise.resolve();
}

function handleSkillsAdd(options, args, settings) {
  const input = args[0];
  if (!input) {
    console.error("Usage: agent-playbook skills add <name|path>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const defaultScope = env.projectRoot ? "project" : "global";
  const scopeInfo = normalizeScopeList(options.scope, env.projectRoot, defaultScope);
  const targetInfo = normalizeTargetList(options.target, "both");
  const resolved = resolveSkillInput(input, env);
  const installMode = resolveInstallMode(options, "link");

  if (resolved.error) {
    console.error(resolved.error);
    process.exitCode = 1;
    return Promise.resolve();
  }

  [...scopeInfo.warnings, ...targetInfo.warnings].forEach((warning) =>
    console.error(`Warning: ${warning}`)
  );

  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);
  const overwriteState = createOverwriteState(options);
  const now = new Date().toISOString();
  const created = [];
  const skipped = [];

  scopeInfo.scopes.forEach((scope) => {
    const dirs = env.scopeDirs[scope];
    if (!dirs) {
      return;
    }
    targetInfo.targets.forEach((target) => {
      const targetDir = dirs[target];
      if (!targetDir) {
        return;
      }
      ensureDir(targetDir, options["dry-run"]);
      const targetPath = path.join(targetDir, resolved.name);
      if (fs.existsSync(targetPath)) {
        if (!shouldOverwriteExisting(options, overwriteState, targetPath)) {
          skipped.push({ scope, target, path: targetPath });
          return;
        }
        if (!options["dry-run"]) {
          safeUnlink(targetPath);
        }
      }

      const install = installSkill(resolved.sourceDir, targetPath, {
        mode: installMode,
        dryRun: options["dry-run"],
      });
      created.push({ scope, target, path: targetPath, mode: install.mode });

      const projectId = scope === "project" ? env.projectId : "global";
      const key = stateKey(resolved.name, scope, target, projectId);
      const entry = stateIndex.get(key) || {
        name: resolved.name,
        scope,
        target,
        project_id: projectId,
        managed_by: "apb",
        installed_at: now,
      };
      entry.source = resolved.sourceDir;
      entry.mode = install.mode;
      entry.disabled = false;
      entry.updated_at = now;
      stateIndex.set(key, entry);
    });
  });

  state.skills = Array.from(stateIndex.values());
  state.updated_at = now;
  saveStateFile(env.statePath, state, options["dry-run"]);

  console.log(`Added skill "${resolved.name}".`);
  if (created.length) {
    created.forEach((item) =>
      console.log(`- ${item.scope}/${item.target}: ${item.path} (${item.mode})`)
    );
  }
  if (skipped.length) {
    skipped.forEach((item) => console.log(`- Skipped ${item.scope}/${item.target}: ${item.path}`));
  }
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }

  return Promise.resolve();
}

function handleSkillsRemove(options, args, settings) {
  const name = args[0];
  if (!name) {
    console.error("Usage: agent-playbook skills remove <name>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);
  const matchesInfo = resolveSkillMatches(name, options, env, stateIndex, "both");
  matchesInfo.warnings.forEach((warning) => console.error(`Warning: ${warning}`));

  const matches = matchesInfo.matches;
  const hasFilters = Boolean(options.scope || options.target);
  if (!matches.length) {
    const staleStateEntries = Array.from(stateIndex.entries()).filter(([, entry]) => {
      return (
        entry.name === name &&
        isStateEntryInEnvironment(entry, env) &&
        matchesInfo.scopeInfo.scopes.includes(entry.scope) &&
        matchesInfo.targetInfo.targets.includes(entry.target)
      );
    });
    if (!hasFilters && staleStateEntries.length > 1) {
      console.error(`Multiple stale state entries for "${name}". Use --scope or --target to disambiguate.`);
      staleStateEntries.forEach(([, entry]) =>
        console.error(`- ${entry.scope}/${entry.target}`)
      );
      process.exitCode = 1;
      return Promise.resolve();
    }
    if (staleStateEntries.length) {
      staleStateEntries.forEach(([key]) => stateIndex.delete(key));
      state.skills = Array.from(stateIndex.values());
      state.updated_at = new Date().toISOString();
      saveStateFile(env.statePath, state, options["dry-run"]);
      const noun = staleStateEntries.length === 1 ? "entry" : "entries";
      console.log(`Removed ${staleStateEntries.length} state ${noun} for "${name}".`);
      return Promise.resolve();
    }
    console.error(`Skill not found: ${name}`);
    process.exitCode = 1;
    return Promise.resolve();
  }

  if (!hasFilters && matches.length > 1) {
    console.error(`Multiple matches for "${name}". Use --scope or --target to disambiguate.`);
    matches.forEach((match) =>
      console.error(`- ${match.scope}/${match.target}: ${match.path}`)
    );
    process.exitCode = 1;
    return Promise.resolve();
  }

  const removed = [];
  const skipped = [];

  matches.forEach((match) => {
    const key = stateKey(match.name, match.scope, match.target, env.projectId);
    const managed = stateIndex.has(key);
    if (!managed && !options.force) {
      skipped.push({ scope: match.scope, target: match.target, path: match.path });
      return;
    }
    if (!options["dry-run"]) {
      safeUnlink(match.path);
    }
    stateIndex.delete(key);
    removed.push({ scope: match.scope, target: match.target, path: match.path });
  });

  state.skills = Array.from(stateIndex.values());
  state.updated_at = new Date().toISOString();
  saveStateFile(env.statePath, state, options["dry-run"]);

  if (removed.length) {
    removed.forEach((item) => console.log(`Removed ${item.scope}/${item.target}: ${item.path}`));
  }
  if (skipped.length) {
    skipped.forEach((item) =>
      console.log(`Skipped unmanaged ${item.scope}/${item.target}: ${item.path} (use --force)`)
    );
  }
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }

  return Promise.resolve();
}

function handleSkillsDisable(options, args, settings) {
  const name = args[0];
  if (!name) {
    console.error("Usage: agent-playbook skills disable <name>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);
  const matchesInfo = resolveSkillMatches(name, options, env, stateIndex, "both");
  matchesInfo.warnings.forEach((warning) => console.error(`Warning: ${warning}`));

  const candidates = matchesInfo.matches.filter((match) => !match.disabled);
  if (!candidates.length) {
    console.error(`No enabled skill found for "${name}".`);
    process.exitCode = 1;
    return Promise.resolve();
  }
  const unmanaged = candidates.filter((match) => !match.managed);
  if (unmanaged.length && !options.force) {
    unmanaged.forEach((match) =>
      console.error(
        `Refusing to disable unmanaged ${match.scope}/${match.target}: ${match.path} (use --force to adopt it)`
      )
    );
    process.exitCode = 1;
    return Promise.resolve();
  }

  const hasFilters = Boolean(options.scope || options.target);
  if (!hasFilters && candidates.length > 1) {
    console.error(`Multiple matches for "${name}". Use --scope or --target to disambiguate.`);
    candidates.forEach((match) =>
      console.error(`- ${match.scope}/${match.target}: ${match.path}`)
    );
    process.exitCode = 1;
    return Promise.resolve();
  }

  const overwriteState = createOverwriteState(options);
  const now = new Date().toISOString();
  const disabled = [];

  candidates.forEach((match) => {
    const skillsRoot = path.dirname(match.path);
    const disabledDir = path.join(skillsRoot, DISABLED_DIR_NAME);
    const disabledPath = path.join(disabledDir, match.name);
    if (fs.existsSync(disabledPath)) {
      if (!shouldOverwriteExisting(options, overwriteState, disabledPath)) {
        return;
      }
      if (!options["dry-run"]) {
        safeUnlink(disabledPath);
      }
    }
    ensureDir(disabledDir, options["dry-run"]);
    if (!options["dry-run"]) {
      fs.renameSync(match.path, disabledPath);
    }
    disabled.push({ scope: match.scope, target: match.target, path: disabledPath });

    const key = stateKey(match.name, match.scope, match.target, env.projectId);
    let entry = stateIndex.get(key);
    if (!entry && options.force) {
      entry = {
        name: match.name,
        scope: match.scope,
        target: match.target,
        project_id: match.scope === "project" ? env.projectId : "global",
        source: match.source || match.path,
        mode: match.mode,
        managed_by: "apb",
        installed_at: now,
      };
      stateIndex.set(key, entry);
    }
    if (entry) {
      entry.disabled = true;
      entry.updated_at = now;
    }
  });

  state.skills = Array.from(stateIndex.values());
  state.updated_at = now;
  saveStateFile(env.statePath, state, options["dry-run"]);

  disabled.forEach((item) => console.log(`Disabled ${item.scope}/${item.target}: ${item.path}`));
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }

  return Promise.resolve();
}

function handleSkillsEnable(options, args, settings) {
  const name = args[0];
  if (!name) {
    console.error("Usage: agent-playbook skills enable <name>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);
  const matchesInfo = resolveSkillMatches(name, options, env, stateIndex, "both");
  matchesInfo.warnings.forEach((warning) => console.error(`Warning: ${warning}`));

  const candidates = matchesInfo.matches.filter((match) => match.disabled);
  if (!candidates.length) {
    console.error(`No disabled skill found for "${name}".`);
    process.exitCode = 1;
    return Promise.resolve();
  }
  const unmanaged = candidates.filter((match) => !match.managed);
  if (unmanaged.length && !options.force) {
    unmanaged.forEach((match) =>
      console.error(
        `Refusing to enable unmanaged ${match.scope}/${match.target}: ${match.path} (use --force to adopt it)`
      )
    );
    process.exitCode = 1;
    return Promise.resolve();
  }

  const hasFilters = Boolean(options.scope || options.target);
  if (!hasFilters && candidates.length > 1) {
    console.error(`Multiple matches for "${name}". Use --scope or --target to disambiguate.`);
    candidates.forEach((match) =>
      console.error(`- ${match.scope}/${match.target}: ${match.path}`)
    );
    process.exitCode = 1;
    return Promise.resolve();
  }

  const overwriteState = createOverwriteState(options);
  const now = new Date().toISOString();
  const enabled = [];

  candidates.forEach((match) => {
    const skillsRoot = path.dirname(path.dirname(match.path));
    const targetPath = path.join(skillsRoot, match.name);
    if (fs.existsSync(targetPath)) {
      if (!shouldOverwriteExisting(options, overwriteState, targetPath)) {
        return;
      }
      if (!options["dry-run"]) {
        safeUnlink(targetPath);
      }
    }
    if (!options["dry-run"]) {
      fs.renameSync(match.path, targetPath);
    }
    enabled.push({ scope: match.scope, target: match.target, path: targetPath });

    const key = stateKey(match.name, match.scope, match.target, env.projectId);
    let entry = stateIndex.get(key);
    if (!entry && options.force) {
      entry = {
        name: match.name,
        scope: match.scope,
        target: match.target,
        project_id: match.scope === "project" ? env.projectId : "global",
        source: match.source || targetPath,
        mode: match.mode,
        managed_by: "apb",
        installed_at: now,
      };
      stateIndex.set(key, entry);
    }
    if (entry) {
      entry.disabled = false;
      entry.updated_at = now;
    }
  });

  state.skills = Array.from(stateIndex.values());
  state.updated_at = now;
  saveStateFile(env.statePath, state, options["dry-run"]);

  enabled.forEach((item) => console.log(`Enabled ${item.scope}/${item.target}: ${item.path}`));
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }

  return Promise.resolve();
}

function checkSkillPath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return "missing";
  }
  try {
    const stat = fs.lstatSync(targetPath);
    if (stat.isSymbolicLink()) {
      try {
        fs.realpathSync(targetPath);
      } catch (error) {
        return "broken";
      }
    }
    const skillFile = path.join(targetPath, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      return "missing-skill-file";
    }
  } catch (error) {
    return "missing";
  }
  return "ok";
}

function handleSkillsDoctor(options, args, settings) {
  const env = buildSkillEnvironment(settings);
  const scopeInfo = normalizeScopeList(options.scope, env.projectRoot, "both");
  const targetInfo = normalizeTargetList(options.target, "both");
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);
  const scan = scanSkills(
    env.scopeDirs,
    scopeInfo.scopes,
    targetInfo.targets,
    stateIndex,
    env.projectId
  );

  const issues = [];
  const duplicateKeys = new Set();

  scan.records.forEach((record) => {
    if (record.status === "broken" || record.status === "missing-skill-file") {
      issues.push(`${record.scope}/${record.target}/${record.name}: ${record.status}`);
    }
    if (record.duplicate) {
      const key = `${record.target}:${record.name}`;
      if (!duplicateKeys.has(key)) {
        duplicateKeys.add(key);
        issues.push(`${record.target}/${record.name}: duplicate across scopes`);
      }
    }
    if (!record.managed) {
      issues.push(`${record.scope}/${record.target}/${record.name}: unmanaged skill`);
    }
  });

  state.skills.forEach((entry) => {
    if (
      !isStateEntryInEnvironment(entry, env) ||
      !scopeInfo.scopes.includes(entry.scope) ||
      !targetInfo.targets.includes(entry.target)
    ) {
      return;
    }
    const dirs = env.scopeDirs[entry.scope];
    if (!dirs) {
      return;
    }
    const root = dirs[entry.target];
    if (!root) {
      return;
    }
    const activePath = path.join(root, entry.name);
    const disabledPath = path.join(root, DISABLED_DIR_NAME, entry.name);
    const pathToCheck = entry.disabled ? disabledPath : activePath;
    const status = checkSkillPath(pathToCheck);
    if (status !== "ok") {
      issues.push(`${entry.scope}/${entry.target}/${entry.name}: managed entry ${status}`);
    }
  });

  if (issues.length) {
    console.error("Issues detected:");
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("No critical issues detected.");
  }

  if (options.fix) {
    const now = new Date().toISOString();
    const overwrite = true;
    let fixedCount = 0;

    state.skills.forEach((entry) => {
      if (
        !isStateEntryInEnvironment(entry, env) ||
        !scopeInfo.scopes.includes(entry.scope) ||
        !targetInfo.targets.includes(entry.target)
      ) {
        return;
      }
      const dirs = env.scopeDirs[entry.scope];
      if (!dirs) {
        return;
      }
      const root = dirs[entry.target];
      if (!root) {
        return;
      }
      const activePath = path.join(root, entry.name);
      const disabledPath = path.join(root, DISABLED_DIR_NAME, entry.name);
      if (entry.disabled) {
        const activeStatus = checkSkillPath(activePath);
        const disabledStatus = checkSkillPath(disabledPath);
        if (activeStatus === "ok") {
          if (disabledStatus === "ok") {
            if (!options["dry-run"]) {
              safeUnlink(disabledPath);
            }
          }
          entry.disabled = false;
          entry.updated_at = now;
          fixedCount += 1;
          return;
        }
        if (disabledStatus === "ok") {
          return;
        }
        if (!fs.existsSync(path.dirname(disabledPath))) {
          ensureDir(path.dirname(disabledPath), options["dry-run"]);
        }
        if (entry.source && fs.existsSync(entry.source)) {
          installSkill(entry.source, disabledPath, {
            mode: entry.mode || "link",
            dryRun: options["dry-run"],
            overwrite,
          });
          entry.updated_at = now;
          fixedCount += 1;
        }
        return;
      }
      const activeStatus = checkSkillPath(activePath);
      if (activeStatus === "ok") {
        return;
      }
      if (entry.source && fs.existsSync(entry.source)) {
        installSkill(entry.source, activePath, {
          mode: entry.mode || "link",
          dryRun: options["dry-run"],
          overwrite,
        });
        entry.updated_at = now;
        fixedCount += 1;
      }
    });

    state.updated_at = now;
    saveStateFile(env.statePath, state, options["dry-run"]);
    console.log(`Fixed ${fixedCount} managed entries.`);
    if (options["dry-run"]) {
      console.log("- Dry run: no changes written.");
    }
  }

  return Promise.resolve();
}

function handleSkillsSync(options, args, settings) {
  const env = buildSkillEnvironment(settings);
  const state = loadStateFile(env.statePath);
  const now = new Date().toISOString();
  let changed = false;

  const nextSkills = [];
  state.skills.forEach((entry) => {
    if (!isStateEntryInEnvironment(entry, env)) {
      nextSkills.push(entry);
      return;
    }
    const dirs = env.scopeDirs[entry.scope];
    if (!dirs) {
      changed = true;
      return;
    }
    const root = dirs[entry.target];
    if (!root) {
      changed = true;
      return;
    }
    const activePath = path.join(root, entry.name);
    const disabledPath = path.join(root, DISABLED_DIR_NAME, entry.name);
    if (entry.disabled) {
      if (fs.existsSync(disabledPath)) {
        nextSkills.push(entry);
        return;
      }
      if (fs.existsSync(activePath)) {
        entry.disabled = false;
        entry.updated_at = now;
        nextSkills.push(entry);
        changed = true;
        return;
      }
      changed = true;
      return;
    }
    if (fs.existsSync(activePath)) {
      nextSkills.push(entry);
      return;
    }
    if (fs.existsSync(disabledPath)) {
      entry.disabled = true;
      entry.updated_at = now;
      nextSkills.push(entry);
      changed = true;
      return;
    }
    changed = true;
  });

  state.skills = nextSkills;
  state.updated_at = now;
  if (changed) {
    saveStateFile(env.statePath, state, options["dry-run"]);
    console.log("State synchronized.");
  } else {
    console.log("State already in sync.");
  }
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }
  return Promise.resolve();
}

function handleSkillsUpgrade(options, args, settings) {
  const env = buildSkillEnvironment(settings);
  const state = loadStateFile(env.statePath);
  const overwrite = true;
  const now = new Date().toISOString();
  const sourceRoot = options.source ? path.resolve(options.source) : env.skillsSource;
  const defaultMode = resolveInstallMode(options, "link");
  let upgraded = 0;
  let skipped = 0;

  state.skills.forEach((entry) => {
    if (!isStateEntryInEnvironment(entry, env)) {
      return;
    }
    if (entry.disabled) {
      skipped += 1;
      return;
    }
    const dirs = env.scopeDirs[entry.scope];
    if (!dirs) {
      skipped += 1;
      return;
    }
    const root = dirs[entry.target];
    if (!root) {
      skipped += 1;
      return;
    }
    const activePath = resolveInside(root, entry.name);
    if (!activePath) {
      skipped += 1;
      return;
    }
    let sourceDir = entry.source;
    if (sourceRoot) {
      const candidate = resolveInside(sourceRoot, entry.name);
      if (candidate && fs.existsSync(path.join(candidate, "SKILL.md"))) {
        sourceDir = candidate;
      }
    }
    if (!sourceDir || !fs.existsSync(sourceDir)) {
      skipped += 1;
      return;
    }

    const install = installSkill(sourceDir, activePath, {
      mode: entry.mode || defaultMode,
      dryRun: options["dry-run"],
      overwrite,
    });
    entry.source = sourceDir;
    entry.mode = install.mode;
    entry.updated_at = now;
    entry.installed_at = now;
    upgraded += 1;
  });

  state.updated_at = now;
  saveStateFile(env.statePath, state, options["dry-run"]);
  console.log(`Upgraded ${upgraded} managed skills. Skipped ${skipped}.`);
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }
  return Promise.resolve();
}

function handleSkillsExport(options, args, settings) {
  const outputPath = options.output;
  if (!outputPath) {
    console.error("Usage: agent-playbook skills export --output <file>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const state = loadStateFile(env.statePath);
  const resolved = path.resolve(outputPath);
  ensureDir(path.dirname(resolved), options["dry-run"]);
  if (!options["dry-run"]) {
    writeJsonAtomic(resolved, state);
  }
  console.log(`Exported state to ${resolved}`);
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }
  return Promise.resolve();
}

function handleSkillsImport(options, args, settings) {
  const inputPath = args[0];
  if (!inputPath) {
    console.error("Usage: agent-playbook skills import <file>");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Import file not found: ${resolved}`);
    process.exitCode = 1;
    return Promise.resolve();
  }

  let imported;
  try {
    imported = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    console.error("Invalid import file.");
    process.exitCode = 1;
    return Promise.resolve();
  }

  const env = buildSkillEnvironment(settings);
  const overwriteState = createOverwriteState(options);
  const now = new Date().toISOString();
  const defaultMode = resolveInstallMode(options, "link");
  const skills = Array.isArray(imported.skills) ? imported.skills : [];
  const state = loadStateFile(env.statePath);
  const stateIndex = indexStateEntries(state);

  let applied = 0;
  let skipped = 0;
  skills.forEach((entry) => {
    if (
      !entry ||
      !isValidSkillName(entry.name) ||
      !VALID_SKILL_SCOPES.has(entry.scope) ||
      !VALID_SKILL_TARGETS.has(entry.target)
    ) {
      skipped += 1;
      return;
    }

    const stateEntry = { ...entry };
    stateEntry.project_id = entry.scope === "project" ? env.projectId : "global";
    if (stateEntry.mode && !VALID_INSTALL_MODES.has(stateEntry.mode)) {
      stateEntry.mode = defaultMode;
    }

    if (entry.disabled) {
      stateIndex.set(
        stateKey(stateEntry.name, stateEntry.scope, stateEntry.target, stateEntry.project_id),
        stateEntry
      );
      return;
    }
    const dirs = env.scopeDirs[entry.scope];
    if (!dirs) {
      skipped += 1;
      return;
    }
    const root = dirs[entry.target];
    if (!root) {
      skipped += 1;
      return;
    }
    const targetPath = resolveInside(root, entry.name);
    if (!targetPath) {
      skipped += 1;
      return;
    }
    let sourceDir = entry.source;
    if (options.source) {
      const candidate = resolveInside(path.resolve(options.source), entry.name);
      if (candidate && fs.existsSync(path.join(candidate, "SKILL.md"))) {
        sourceDir = candidate;
      }
    }
    if (!sourceDir || !fs.existsSync(sourceDir)) {
      skipped += 1;
      return;
    }
    if (fs.existsSync(targetPath)) {
      if (!shouldOverwriteExisting(options, overwriteState, targetPath)) {
        skipped += 1;
        return;
      }
      if (!options["dry-run"]) {
        safeUnlink(targetPath);
      }
    }
    installSkill(sourceDir, targetPath, {
      mode: stateEntry.mode || defaultMode,
      dryRun: options["dry-run"],
    });
    stateEntry.updated_at = now;
    stateIndex.set(
      stateKey(stateEntry.name, stateEntry.scope, stateEntry.target, stateEntry.project_id),
      stateEntry
    );
    applied += 1;
  });

  state.version = "2";
  state.updated_at = now;
  state.skills = Array.from(stateIndex.values());
  saveStateFile(env.statePath, state, options["dry-run"]);
  console.log(`Imported state (${applied} applied, ${skipped} skipped).`);
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }
  return Promise.resolve();
}

function ensureLocalCli(settings, context, options) {
  const baseDir = settings.projectMode ? settings.claudeDir : settings.claudeDir;
  const cliRoot = path.join(baseDir, LOCAL_CLI_DIR);
  const targetBin = path.join(cliRoot, "bin", "agent-playbook.js");
  const sourceRoot = path.resolve(__dirname, "..");

  if (options["dry-run"]) {
    return targetBin;
  }

  ensureDir(cliRoot, false);
  fs.cpSync(path.join(sourceRoot, "bin"), path.join(cliRoot, "bin"), { recursive: true });
  fs.cpSync(path.join(sourceRoot, "src"), path.join(cliRoot, "src"), { recursive: true });
  fs.cpSync(path.join(sourceRoot, "package.json"), path.join(cliRoot, "package.json"));

  fs.chmodSync(targetBin, 0o755);
  return targetBin;
}

function updateClaudeSettings(settings, cliPath, options) {
  const settingsPath = settings.claudeSettingsPath;
  const existing = readJsonSafe(settingsPath);
  if (existing === null && fs.existsSync(settingsPath)) {
    console.error("Warning: unable to parse Claude settings.json, skipping hook update.");
    return false;
  }
  const data = existing || {};

  data.hooks = data.hooks || {};
  const marker = `--hook-source ${HOOK_SOURCE_VALUE}`;
  data.hooks = removeHookCommand(data.hooks, "SessionEnd", marker);
  data.hooks = removeHookCommand(data.hooks, "PostToolUse", marker);
  data.hooks = removeHookCommand(data.hooks, "PostToolUseFailure", marker);

  const sessionArgs = [
    cliPath,
    "session-log",
    "--hook-source",
    HOOK_SOURCE_VALUE,
  ];
  if (options["session-dir"]) {
    const sessionDir = path.resolve(options["session-dir"]);
    sessionArgs.push("--session-dir", sessionDir);
  }
  const sessionHook = { type: "command", command: process.execPath, args: sessionArgs };
  const improveHook = {
    type: "command",
    command: process.execPath,
    args: [cliPath, "self-improve", "--hook-source", HOOK_SOURCE_VALUE],
  };

  ensureHook(data.hooks, "SessionEnd", null, sessionHook);
  ensureHook(data.hooks, "PostToolUseFailure", "*", improveHook);

  data.agentPlaybook = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    cliPath,
  };

  if (!options["dry-run"]) {
    backupFile(settingsPath);
    ensureDir(path.dirname(settingsPath), false);
    writeJsonAtomic(settingsPath, data);
  }
  return true;
}

function removeHooks(settings) {
  const settingsPath = settings.claudeSettingsPath;
  const data = readJsonSafe(settingsPath);
  if (!data) {
    return;
  }

  if (data.hooks) {
    const marker = `--hook-source ${HOOK_SOURCE_VALUE}`;
    data.hooks = removeHookCommand(data.hooks, "SessionEnd", marker);
    data.hooks = removeHookCommand(data.hooks, "PostToolUse", marker);
    data.hooks = removeHookCommand(data.hooks, "PostToolUseFailure", marker);
  }

  delete data.agentPlaybook;

  writeJsonAtomic(settingsPath, data);
}

function updateCodexConfig(settings, options) {
  if (options["dry-run"]) {
    return;
  }

  ensureDir(settings.codexDir, false);
  const configPath = settings.codexConfigPath;
  const content = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const updated = upsertCodexBlock(content, {
    version: VERSION,
    installed_at: new Date().toISOString(),
  });

  backupFile(configPath);
  writeFileAtomic(configPath, updated);
}

function removeCodexConfig(settings) {
  const configPath = settings.codexConfigPath;
  if (!fs.existsSync(configPath)) {
    return;
  }
  const content = fs.readFileSync(configPath, "utf8");
  const cleaned = removeCodexBlock(content);
  writeFileAtomic(configPath, cleaned ? `${cleaned}\n` : "");
}

function assertCodexConfigReadable(settings) {
  const configPath = settings.codexConfigPath;
  if (!fs.existsSync(configPath)) {
    return;
  }
  removeCodexBlock(fs.readFileSync(configPath, "utf8"));
}

function assertClaudeSettingsReadable(settings) {
  const settingsPath = settings.claudeSettingsPath;
  const data = readJsonStrict(settingsPath, null);
  if (data !== null && (typeof data !== "object" || Array.isArray(data))) {
    const error = new Error(`Invalid Claude settings schema in ${settingsPath}; refusing mutation.`);
    error.code = "APB_INVALID_CLAUDE_SETTINGS";
    throw error;
  }
}

function removeLocalCli(settings) {
  const cliRoot = path.join(settings.claudeDir, LOCAL_CLI_DIR);
  if (fs.existsSync(cliRoot)) {
    fs.rmSync(cliRoot, { recursive: true, force: true });
  }
}

function ensureHook(hooks, eventName, matcher, hookHandler) {
  hooks[eventName] = hooks[eventName] || [];
  const entries = hooks[eventName];

  let entry = entries.find((item) => (matcher ? item.matcher === matcher : !item.matcher));
  if (!entry) {
    entry = matcher ? { matcher, hooks: [] } : { hooks: [] };
    entries.push(entry);
  }

  entry.hooks = entry.hooks || [];
  const signature = hookHandlerSignature(hookHandler);
  const exists = entry.hooks.some((hook) => hookHandlerSignature(hook) === signature);
  if (!exists) {
    entry.hooks.push(hookHandler);
  }
}

function removeHookCommand(hooks, eventName, command) {
  const entries = hooks[eventName];
  if (!entries) {
    return hooks;
  }

  hooks[eventName] = entries
    .map((entry) => {
      const nextHooks = (entry.hooks || []).filter(
        (hook) => !hookHandlerText(hook).includes(command)
      );
      return { ...entry, hooks: nextHooks };
    })
    .filter((entry) => (entry.hooks || []).length > 0);

  if (!hooks[eventName].length) {
    delete hooks[eventName];
  }

  return hooks;
}

function hookHandlerSignature(hook) {
  return JSON.stringify({
    type: hook?.type || "",
    command: hook?.command || "",
    args: Array.isArray(hook?.args) ? hook.args : [],
  });
}

function hookHandlerText(hook) {
  const args = Array.isArray(hook?.args) ? hook.args : [];
  return [hook?.command, ...args].map((value) => String(value || "")).join(" ");
}

function resolveSessionDir(explicit, dataRoot, projectId) {
  if (explicit) {
    return path.resolve(explicit);
  }
  return path.join(dataRoot, DEFAULT_SESSION_DIR, projectId);
}

function readTranscript(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) {
    return [];
  }
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  const events = [];

  lines.forEach((line) => {
    if (!line.trim()) {
      return;
    }
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      return;
    }
  });

  return events;
}

function resolveUniquePath(filePath) {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }
  const parsed = path.parse(filePath);
  let counter = 1;
  let candidate = filePath;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }
  return candidate;
}

function collectTranscriptInsights(events, projectRoot) {
  const insights = {
    userMessages: [],
    assistantMessages: [],
    commands: [],
    files: [],
    questions: [],
    lastUserPrompt: "",
  };

  events.forEach((event) => {
    const role = getEventRole(event);
    const text = redactSensitiveText(extractEventText(event), projectRoot);

    if (!text) {
      return;
    }

    if (role === "user") {
      insights.userMessages.push(text);
      insights.lastUserPrompt = text;
    }

    if (role === "assistant") {
      insights.assistantMessages.push(text);
      insights.commands.push(...extractCommands(text));
      insights.questions.push(...extractQuestions(text));
    }

    insights.files.push(...extractFilePaths(text));
  });

  insights.commands = uniqueList(insights.commands, 12);
  insights.files = uniqueList(insights.files, 12);
  insights.questions = uniqueList(insights.questions, 8);

  return insights;
}

function getEventRole(event) {
  if (!event) {
    return "";
  }
  if (event.message && typeof event.message.role === "string") {
    return event.message.role;
  }
  if (typeof event.role === "string") {
    return event.role;
  }
  if (event.type === "user" || event.type === "assistant") {
    return event.type;
  }
  return "";
}

function extractEventText(event) {
  if (!event) {
    return "";
  }
  if (event.message) {
    if (event.message.content) {
      return extractText(event.message.content);
    }
    if (event.message.text) {
      return extractText(event.message.text);
    }
  }
  if (event.content) {
    return extractText(event.content);
  }
  if (event.text) {
    return extractText(event.text);
  }
  return "";
}

function extractCommands(text) {
  const commands = [];
  if (!text) {
    return commands;
  }

  const paramRegex = /<parameter name=\"command\">([\s\S]*?)<\/parameter>/g;
  let match = paramRegex.exec(text);
  while (match) {
    commands.push(...splitCommands(match[1]));
    match = paramRegex.exec(text);
  }

  const fenceRegex = /```(?:bash|sh|zsh|shell)?\n([\s\S]*?)```/g;
  match = fenceRegex.exec(text);
  while (match) {
    commands.push(...splitCommands(match[1]));
    match = fenceRegex.exec(text);
  }

  return commands.map((cmd) => cmd.trim()).filter(Boolean);
}

function splitCommands(block) {
  return String(block || "")
    .split("\n")
    .map((line) => line.replace(/^\s*\$\s?/, "").trim())
    .filter((line) => line && !line.startsWith("#"));
}

function extractQuestions(text) {
  if (!text) {
    return [];
  }
  const questions = [];
  const lines = text.split("\n");
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.includes("?") && trimmed.length <= 200) {
      questions.push(trimmed.replace(/^[*-]\s*/, ""));
    }
  });
  return questions;
}

function extractFilePaths(text) {
  if (!text) {
    return [];
  }
  const regex = /\b[\w./~\-]+?\.(?:md|mdx|json|jsonl|js|ts|tsx|jsx|py|sh|toml|yaml|yml|txt|lock)\b/gi;
  const matches = text.match(regex);
  return matches ? matches : [];
}

function extractText(content) {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  if (content && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

function buildTopic(prompt, cwd) {
  if (prompt) {
    return slugify(prompt).slice(0, 40) || "session";
  }

  return slugify(path.basename(cwd)) || "session";
}

function buildSessionSummary(insights, sessionId, projectId) {
  const now = new Date();
  const date = formatDate(now);
  const title = insights.lastUserPrompt ? trimTo(insights.lastUserPrompt, 60) : "Session";
  const actions = insights.commands.length
    ? insights.commands.map((cmd) => `- [x] \`${trimTo(cmd, 120)}\``)
    : ["- [ ] (auto) No commands captured"];
  const relatedFiles = insights.files.length
    ? insights.files.map((file) => `- \`${file}\``)
    : ["- (auto) None captured"];
  const questions = insights.questions.length
    ? insights.questions.map((question) => `- ${question}`)
    : ["- (auto) None captured"];

  const summaryLines = [
    `# Session: ${title}`,
    "",
    `**Date**: ${date}`,
    `**Duration**: unknown`,
    `**Context**: ${projectId}`,
    `**Agent Playbook Version**: ${VERSION}`,
    "",
    "## Summary",
    "Auto-generated session log.",
    `- Messages: ${insights.userMessages.length} user, ${insights.assistantMessages.length} assistant`,
    `- Commands detected: ${insights.commands.length}`,
    `- Files referenced: ${insights.files.length}`,
    insights.lastUserPrompt
      ? `- Last user prompt: ${trimTo(insights.lastUserPrompt, 120)}`
      : "- Last user prompt: (not available)",
    "",
    "## Key Decisions",
    "1. (auto) No structured decisions extracted",
    "",
    "## Actions Taken",
    ...actions,
    "",
    "## Technical Notes",
    `Session reference: ${hashIdentity(sessionId)}`,
    "",
    "## Open Questions / Follow-ups",
    ...questions,
    "",
    "## Related Files",
    ...relatedFiles,
    "",
  ];

  return summaryLines.join("\n");
}

function collectStatus(settings) {
  const claudeSettings = readJsonSafe(settings.claudeSettingsPath);
  const manifestPath = path.join(settings.claudeSkillsDir, ".agent-playbook.json");
  const manifest = readJsonSafe(manifestPath);
  const manifestPresent = fs.existsSync(manifestPath);
  const manifestReadable = manifest !== null || !manifestPresent;
  const hooksExpected = !manifest || manifest.hooksEnabled !== false;
  const localCliPackagePath = path.join(settings.claudeDir, LOCAL_CLI_DIR, "package.json");
  const localCliPackage = readJsonSafe(localCliPackagePath);
  const localCliVersion = localCliPackage && localCliPackage.version;
  return {
    skillsSource: settings.skillsSource,
    claudeSettingsPath: settings.claudeSettingsPath,
    codexConfigPath: settings.codexConfigPath,
    claudeSkillsDir: settings.claudeSkillsDir,
    codexSkillsDir: settings.codexSkillsDir,
    geminiSkillsDir: settings.geminiSkillsDir,
    dshSkillsDir: settings.dshSkillsDir,
    claudeSettingsReadable: claudeSettings !== null || !fs.existsSync(settings.claudeSettingsPath),
    stateReadable: isJsonReadable(settings.statePath),
    manifestReadable,
    hooksExpected,
    codexConfigReadable: isCodexConfigReadable(settings.codexConfigPath),
    codexBlockPresent: hasCodexBlock(settings.codexConfigPath),
    hooksInstalled: hasHooks(settings.claudeSettingsPath),
    manifestPresent,
    localCliPresent: fs.existsSync(path.join(settings.claudeDir, LOCAL_CLI_DIR, "bin", "agent-playbook.js")),
    localCliVersion: localCliVersion || null,
    localCliVersionMatches: localCliVersion === VERSION,
    claudeSkillCount: countSkills(settings.claudeSkillsDir),
    codexSkillCount: countSkills(settings.codexSkillsDir),
    geminiSkillCount: countSkills(settings.geminiSkillsDir),
    dshSkillCount: countSkills(settings.dshSkillsDir),
  };
}

function hasHooks(settingsPath) {
  const data = readJsonSafe(settingsPath);
  if (!data || !data.hooks) {
    return false;
  }
  const sessionHook = (data.hooks.SessionEnd || []).some((entry) =>
    (entry.hooks || []).some((hook) => hookHandlerText(hook).includes("session-log"))
  );
  const improveHook = (data.hooks.PostToolUseFailure || []).some((entry) =>
    (entry.hooks || []).some((hook) => hookHandlerText(hook).includes("self-improve"))
  );
  return sessionHook && improveHook;
}

function resolveHooksEnabled(options, settingsPath) {
  if (options.hooks === true) {
    return true;
  }
  if (options.hooks === false) {
    return false;
  }
  return hasHooks(settingsPath);
}

function assertSessionDirRequiresHooks(options, hooksEnabled) {
  if (options["session-dir"] && !hooksEnabled) {
    throw new Error("--session-dir requires Claude hooks; pass --hooks explicitly.");
  }
}

function summarizeIssues(status) {
  const issues = [];
  if (!status.skillsSource) {
    issues.push("skills source not found (run init from repo or use --repo)");
  }
  if (!status.claudeSettingsReadable) {
    issues.push("unable to parse ~/.claude/settings.json");
  }
  if (!status.stateReadable) {
    issues.push("unable to parse Agent Playbook state.json; refusing fail-open recovery");
  }
  if (!status.manifestReadable) {
    issues.push("unable to parse Claude skill manifest (.agent-playbook.json)");
  }
  if (!status.codexConfigReadable) {
    issues.push("malformed Agent Playbook marker block in Codex config");
  }
  if (!status.manifestPresent) {
    issues.push("missing Claude skill manifest (.agent-playbook.json)");
  }
  if (status.hooksExpected && !status.hooksInstalled) {
    issues.push("Claude hooks not installed");
  }
  if (status.hooksExpected && !status.localCliPresent) {
    issues.push("Claude local CLI not installed under ~/.claude/agent-playbook");
  } else if (status.hooksExpected && !status.localCliVersionMatches) {
    issues.push(
      `Claude hook CLI version mismatch (installed ${status.localCliVersion || "unknown"}, expected ${VERSION})`
    );
  }
  if (!status.codexBlockPresent) {
    issues.push("Codex config missing agent_playbook block");
  }
  return issues;
}

function printStatus(status) {
  console.log("Agent Playbook Status:");
  console.log(`- Skills source: ${status.skillsSource || "(not found)"}`);
  console.log(`- Claude settings: ${status.claudeSettingsPath}`);
  console.log(`- Codex config: ${status.codexConfigPath}`);
  console.log(`- Claude skills: ${status.claudeSkillsDir}`);
  console.log(`- Codex skills: ${status.codexSkillsDir}`);
  console.log(`- Gemini skills: ${status.geminiSkillsDir}`);
  console.log(`- DeepSeek Harness skills: ${status.dshSkillsDir}`);
  console.log(`- Claude skills count: ${status.claudeSkillCount}`);
  console.log(`- Codex skills count: ${status.codexSkillCount}`);
  console.log(`- Gemini skills count: ${status.geminiSkillCount}`);
  console.log(`- DeepSeek Harness skills count: ${status.dshSkillCount}`);
  console.log(`- Claude hooks expected: ${status.hooksExpected ? "yes" : "no"}`);
  console.log(`- Claude hooks installed: ${status.hooksInstalled ? "yes" : "no"}`);
  console.log(`- Claude manifest present: ${status.manifestPresent ? "yes" : "no"}`);
  console.log(`- Claude local CLI present: ${status.localCliPresent ? "yes" : "no"}`);
  console.log(`- Claude local CLI version: ${status.localCliVersion || "unknown"}`);
  console.log(
    `- Hook CLI matches package: ${
      status.hooksExpected ? (status.localCliVersionMatches ? "yes" : "no") : "n/a (hooks disabled)"
    }`
  );
  console.log(`- Codex config block: ${status.codexBlockPresent ? "yes" : "no"}`);
}

function printConformance(report) {
  console.log("Agent Playbook Host Conformance:");
  console.log(`- Scope: ${report.scope}`);
  console.log(`- Overall: ${report.overall}`);
  report.hosts.forEach((host) => {
    console.log(`- ${host.name}:`);
    Object.entries(host.capabilities).forEach(([name, capability]) => {
      console.log(`  - ${name}: ${capability.status} — ${capability.evidence}`);
    });
  });
  console.log(`- Qualification: ${report.qualification}`);
}

function printInitSummary(
  settings,
  hooksEnabled,
  options,
  claudeLinks,
  codexLinks,
  geminiLinks,
  dshLinks,
  warnings
) {
  console.log("Init complete.");
  console.log(`- Claude skills: ${settings.claudeSkillsDir}`);
  console.log(`- Codex skills: ${settings.codexSkillsDir}`);
  console.log(`- Gemini skills: ${settings.geminiSkillsDir}`);
  console.log(`- DeepSeek Harness skills: ${settings.dshSkillsDir}`);
  console.log(`- Hooks: ${hooksEnabled ? "enabled" : "disabled"}`);
  const linkedCount =
    claudeLinks.created.length +
    codexLinks.created.length +
    (geminiLinks ? geminiLinks.created.length : 0) +
    (dshLinks ? dshLinks.created.length : 0);
  console.log(`- Linked skills: ${linkedCount}`);
  const overwrittenCount =
    (claudeLinks.overwritten ? claudeLinks.overwritten.length : 0) +
    (codexLinks.overwritten ? codexLinks.overwritten.length : 0) +
    (geminiLinks && geminiLinks.overwritten ? geminiLinks.overwritten.length : 0) +
    (dshLinks && dshLinks.overwritten ? dshLinks.overwritten.length : 0);
  if (overwrittenCount) {
    console.log(`- Overwritten skills: ${overwrittenCount}`);
  }
  if (
    claudeLinks.skipped.length ||
    codexLinks.skipped.length ||
    (geminiLinks && geminiLinks.skipped.length) ||
    (dshLinks && dshLinks.skipped.length)
  ) {
    console.log("- Some skills were skipped due to existing paths.");
  }
  if (warnings && warnings.length) {
    warnings.forEach((warning) => console.log(`- Warning: ${warning}`));
  }
  if (options["dry-run"]) {
    console.log("- Dry run: no changes written.");
  }
}

function uniqueList(items, limit) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = String(item || "").trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
    if (limit && result.length >= limit) {
      break;
    }
  }
  return result;
}

function countSkills(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let count = 0;
  entries.forEach((entry) => {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      return;
    }
    const skillPath = path.join(dirPath, entry.name);
    const skillFile = path.join(skillPath, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      count += 1;
    }
  });
  return count;
}

function hasCodexBlock(configPath) {
  if (!fs.existsSync(configPath)) {
    return false;
  }
  const content = fs.readFileSync(configPath, "utf8");
  return /^\[agent_playbook\]/m.test(content);
}

function isCodexConfigReadable(configPath) {
  if (!fs.existsSync(configPath)) {
    return true;
  }
  try {
    removeCodexBlock(fs.readFileSync(configPath, "utf8"));
    return true;
  } catch (error) {
    return false;
  }
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
}

function isSameLink(targetPath, sourcePath) {
  try {
    const stat = fs.lstatSync(targetPath);
    if (!stat.isSymbolicLink()) {
      return false;
    }
    const realTarget = fs.realpathSync(targetPath);
    return realTarget === sourcePath;
  } catch (error) {
    return false;
  }
}

function ensureDir(dirPath, dryRun) {
  if (dryRun) {
    return;
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function isJsonReadable(filePath) {
  if (!fs.existsSync(filePath)) {
    return true;
  }
  try {
    readJsonStrict(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function safeUnlink(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function trimTo(value, length) {
  const text = String(value || "");
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length - 3)}...`;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function readStdinJson() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve({});
      return;
    }
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      if (!input.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(input));
      } catch (error) {
        resolve({});
      }
    });
  });
}

module.exports = { main };
function handleRepair(options, context) {
  const settings = resolveSettings(options, context);
  assertCodexConfigReadable(settings);
  const status = collectStatus(settings);
  const warnings = [];
  const overwriteState = createOverwriteState(options);
  const manifestPath = path.join(settings.claudeSkillsDir, ".agent-playbook.json");
  const previousManifest = readJsonStrict(manifestPath, null);
  const hooksEnabled = resolveHooksEnabled(options, settings.claudeSettingsPath);
  assertSessionDirRequiresHooks(options, hooksEnabled);
  if (hooksEnabled || options.hooks === false) {
    assertClaudeSettingsReadable(settings);
  }

  if (!settings.skillsSource) {
    warnings.push("Skills directory not found; skipping skill linking.");
  }

  if (!options["dry-run"]) {
    ensureDir(settings.claudeSkillsDir, false);
    ensureDir(settings.codexSkillsDir, false);
    ensureDir(settings.geminiSkillsDir, false);
    ensureDir(settings.dshSkillsDir, false);
  }

  if (hooksEnabled) {
    ensureLocalCli(settings, context, options);
    const updated = updateClaudeSettings(
      settings,
      path.join(settings.claudeDir, LOCAL_CLI_DIR, "bin", "agent-playbook.js"),
      options
    );
    if (updated === false) {
      warnings.push("Unable to update Claude settings (invalid JSON).");
    }
  } else if (options.hooks === false) {
    removeHooks(settings);
    removeLocalCli(settings);
  }

  if (!status.codexBlockPresent) {
    updateCodexConfig(settings, options);
  }

  if (settings.skillsSource) {
    const claudeLinks = linkSkills(
      settings.skillsSource,
      settings.claudeSkillsDir,
      options,
      overwriteState
    );
    const codexLinks = linkSkills(
      settings.skillsSource,
      settings.codexSkillsDir,
      options,
      overwriteState
    );
    const geminiLinks = linkSkills(
      settings.skillsSource,
      settings.geminiSkillsDir,
      options,
      overwriteState
    );
    const dshLinks = linkSkills(
      settings.skillsSource,
      settings.dshSkillsDir,
      options,
      overwriteState
    );
    if (!options["dry-run"]) {
      const previousLinks = previousManifest && previousManifest.links ? previousManifest.links : {};
      writeJsonAtomic(manifestPath, {
        name: APP_NAME,
        version: VERSION,
        installedAt:
          (previousManifest && previousManifest.installedAt) || new Date().toISOString(),
        repairedAt: new Date().toISOString(),
        repoRoot: settings.repoRoot,
        hooksEnabled: hasHooks(settings.claudeSettingsPath),
        links: {
          claude: collectManagedResources(
            previousLinks.claude,
            claudeLinks,
            settings.claudeSkillsDir
          ),
          codex: collectManagedResources(
            previousLinks.codex,
            codexLinks,
            settings.codexSkillsDir
          ),
          gemini: collectManagedResources(
            previousLinks.gemini,
            geminiLinks,
            settings.geminiSkillsDir
          ),
          dsh: collectManagedResources(previousLinks.dsh, dshLinks, settings.dshSkillsDir),
        },
      });
    }
  }

  printInitSummary(
    settings,
    options["dry-run"] ? hooksEnabled : hasHooks(settings.claudeSettingsPath),
    options,
    { created: [], skipped: [] },
    { created: [], skipped: [] },
    { created: [], skipped: [] },
    { created: [], skipped: [] },
    warnings
  );
  return Promise.resolve();
}

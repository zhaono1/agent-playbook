"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const PACKAGE_NAME = "@codeharbor/agent-playbook";
const APP_NAME = "agent-playbook";
const SKILLS_DIR_NAME = "skills";
const DEFAULT_SESSION_DIR = "sessions";
const LOCAL_CLI_DIR = "agent-playbook";
const HOOK_SOURCE_VALUE = "agent-playbook";
const STATE_FILE_NAME = "state.json";
const DISABLED_DIR_NAME = ".disabled";

const packageJson = readJsonSafe(path.join(__dirname, "..", "package.json"));
const VERSION = packageJson.version || "0.0.0";

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
    case "repair":
      return handleRepair({ ...options, repair: true }, context);
    case "uninstall":
      return handleUninstall(options, context);
    case "session-log":
      return handleSessionLog(options);
    case "self-improve":
      return handleSelfImprove(options);
    case "skills":
      return handleSkills(options, parsed.positionals, context);
    case "upgrade":
      return handleUpgrade(options);
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
    `  ${APP_NAME} repair [--project] [--overwrite] [--repo <path>]`,
    `  ${APP_NAME} uninstall [--project] [--repo <path>]`,
    `  ${APP_NAME} skills [list|info|add|remove|enable|disable|doctor|sync|upgrade|export|import]`,
    "",
    "Hook commands:",
    `  ${APP_NAME} session-log [--session-dir <path>]`,
    `  ${APP_NAME} self-improve`,
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
  const hooksEnabled = options.hooks !== false;
  const repoRoot = settings.repoRoot;
  const warnings = [];
  const overwriteState = createOverwriteState(options);

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

  const manifest = {
    name: APP_NAME,
    version: VERSION,
    installedAt: new Date().toISOString(),
    repoRoot,
    copyMode: Boolean(options.copy),
    links: {
      claude: [],
      codex: [],
      gemini: [],
    },
  };

  let claudeLinks = { created: [], skipped: [] };
  let codexLinks = { created: [], skipped: [] };
  let geminiLinks = { created: [], skipped: [] };
  if (settings.skillsSource) {
    claudeLinks = linkSkills(settings.skillsSource, settings.claudeSkillsDir, options, overwriteState);
    codexLinks = linkSkills(settings.skillsSource, settings.codexSkillsDir, options, overwriteState);
    geminiLinks = linkSkills(settings.skillsSource, settings.geminiSkillsDir, options, overwriteState);
    manifest.links.claude = claudeLinks.created;
    manifest.links.codex = codexLinks.created;
    manifest.links.gemini = geminiLinks.created;

    if (!options["dry-run"]) {
      writeJson(path.join(settings.claudeSkillsDir, ".agent-playbook.json"), manifest);
    }
  }

  if (hooksEnabled) {
    const hookCommandPath = ensureLocalCli(settings, context, options);
    const hookUpdated = updateClaudeSettings(settings, hookCommandPath, options);
    if (hookUpdated === false) {
      warnings.push("Unable to update Claude settings (invalid JSON).");
    }
  }

  updateCodexConfig(settings, options);

  printInitSummary(settings, hooksEnabled, options, claudeLinks, codexLinks, geminiLinks, warnings);
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

function handleUninstall(options, context) {
  const settings = resolveSettings(options, context || {});
  const manifestPath = path.join(settings.claudeSkillsDir, ".agent-playbook.json");
  const manifest = readJsonSafe(manifestPath);

  if (manifest && manifest.links) {
    removeLinks(manifest.links.claude || []);
    removeLinks(manifest.links.codex || []);
    removeLinks(manifest.links.gemini || []);
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
  const sessionDir = resolveSessionDir(options["session-dir"], cwd);

  ensureDir(sessionDir, false);

  const events = transcriptPath ? readTranscript(transcriptPath) : [];
  const insights = collectTranscriptInsights(events);
  const lastUserPrompt = insights.lastUserPrompt;
  const topic = buildTopic(lastUserPrompt, cwd);
  const fileName = `${formatDate(new Date())}-${topic}.md`;
  const outputPath = resolveUniquePath(path.join(sessionDir, fileName));
  const summary = buildSessionSummary(insights, sessionId, cwd);

  fs.writeFileSync(outputPath, summary, "utf8");
  console.error(`Session log saved to ${outputPath}`);
}

async function handleSelfImprove(options) {
  const input = await readStdinJson();
  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || "unknown";
  const transcriptPath = input.transcript_path || "";
  const now = new Date();
  const memoryRoot = path.join(os.homedir(), ".claude", "memory");
  const episodicDir = path.join(memoryRoot, "episodic", String(now.getFullYear()));
  const workingDir = path.join(memoryRoot, "working");
  const triggersDir = path.join(memoryRoot, "triggers");

  ensureDir(episodicDir, false);
  ensureDir(workingDir, false);
  ensureDir(triggersDir, false);

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};
  const toolOutput = input.tool_output || {};
  const hookEvent = input.hook_event_name || "PostToolUse";

  const entry = {
    id: `ep-${now.toISOString()}`.replace(/[:.]/g, "-"),
    timestamp: now.toISOString(),
    session_id: sessionId,
    cwd,
    transcript_path: transcriptPath,
    agent_playbook_version: VERSION,
    hook_event: hookEvent,
    tool_name: toolName,
    tool_input: toolInput,
    tool_output: typeof toolOutput === "string" ? toolOutput.slice(0, 2000) : toolOutput,
  };

  // Detect skill invocations and completions
  if (toolName === "Skill") {
    const skillName = toolInput.skill || "";
    entry.skill_invoked = skillName;
    entry.skill_args = toolInput.args || "";

    // Track skill start in working memory
    const skillStatePath = path.join(workingDir, "active_skills.json");
    const skillState = readJsonSafe(skillStatePath) || { active: [], history: [] };

    if (!skillState.active.includes(skillName)) {
      skillState.active.push(skillName);
      skillState.history.push({
        skill: skillName,
        started_at: now.toISOString(),
        session_id: sessionId,
      });
      writeJson(skillStatePath, skillState);
    }
  }

  // Detect skill completion patterns in tool output
  const skillCompletion = detectSkillCompletion(toolName, toolInput, toolOutput, cwd);
  if (skillCompletion) {
    entry.skill_completed = skillCompletion.skill;
    entry.completion_type = skillCompletion.type;

    // Update active skills state
    const skillStatePath = path.join(workingDir, "active_skills.json");
    const skillState = readJsonSafe(skillStatePath) || { active: [], history: [] };
    skillState.active = skillState.active.filter((s) => s !== skillCompletion.skill);

    const historyEntry = skillState.history.find(
      (h) => h.skill === skillCompletion.skill && !h.completed_at
    );
    if (historyEntry) {
      historyEntry.completed_at = now.toISOString();
      historyEntry.completion_type = skillCompletion.type;
    }
    writeJson(skillStatePath, skillState);

    // Create trigger file for skill chaining
    createSkillTrigger(triggersDir, skillCompletion, sessionId, cwd, now);
  }

  const entryPath = path.join(episodicDir, `${entry.id}.json`);
  fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2));

  const workingPath = path.join(workingDir, "current_session.json");
  fs.writeFileSync(workingPath, JSON.stringify(entry, null, 2));
  console.error(`Self-improvement entry saved to ${entryPath}`);
}

async function handleUpgrade(options) {
  const { execSync } = require("child_process");
  console.log(`Current version: ${VERSION}`);
  console.log(`Checking for updates...`);

  try {
    const latestVersion = execSync(`npm view ${PACKAGE_NAME} version`, {
      encoding: "utf8",
    }).trim();

    if (latestVersion === VERSION) {
      console.log(`Already at the latest version (${VERSION}).`);
      return;
    }

    console.log(`New version available: ${latestVersion}`);
    console.log(`Upgrading ${PACKAGE_NAME}...`);

    execSync(`npm install -g ${PACKAGE_NAME}@latest`, {
      stdio: "inherit",
    });

    console.log(`Successfully upgraded to ${latestVersion}.`);
  } catch (error) {
    console.error(`Upgrade failed: ${error.message}`);
    process.exit(1);
  }
}

function detectSkillCompletion(toolName, toolInput, toolOutput, cwd) {
  const outputStr = typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput);

  // Detect PRD completion
  if (toolName === "Write" || toolName === "Edit") {
    const filePath = toolInput.file_path || "";
    if (filePath.includes("-prd.md") || filePath.includes("prd-task-plan.md")) {
      if (outputStr.includes("COMPLETE") || outputStr.includes("Phase 6")) {
        return { skill: "prd-planner", type: "prd_complete", file: filePath };
      }
    }
  }

  // Detect commit completion (commit-helper)
  if (toolName === "Bash") {
    const command = toolInput.command || "";
    if (command.includes("git commit") && !outputStr.includes("error") && !outputStr.includes("fatal")) {
      return { skill: "commit-helper", type: "commit_complete", command };
    }
  }

  // Detect PR creation (create-pr)
  if (toolName === "Bash") {
    const command = toolInput.command || "";
    if (command.includes("gh pr create") && outputStr.includes("github.com")) {
      const prUrlMatch = outputStr.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
      return {
        skill: "create-pr",
        type: "pr_created",
        pr_url: prUrlMatch ? prUrlMatch[0] : null,
      };
    }
  }

  // Detect test completion
  if (toolName === "Bash") {
    const command = toolInput.command || "";
    if (
      (command.includes("npm test") ||
        command.includes("bun test") ||
        command.includes("pytest") ||
        command.includes("go test")) &&
      (outputStr.includes("passed") || outputStr.includes("PASS"))
    ) {
      return { skill: "test-automator", type: "tests_passed", command };
    }
  }

  // Detect session log creation
  if (toolName === "Write") {
    const filePath = toolInput.file_path || "";
    if (filePath.includes("sessions/") && filePath.endsWith(".md")) {
      return { skill: "session-logger", type: "session_saved", file: filePath };
    }
  }

  return null;
}

function createSkillTrigger(triggersDir, completion, sessionId, cwd, now) {
  const triggerFile = path.join(
    triggersDir,
    `${completion.skill}-${now.toISOString().replace(/[:.]/g, "-")}.json`
  );

  const trigger = {
    source_skill: completion.skill,
    completion_type: completion.type,
    timestamp: now.toISOString(),
    session_id: sessionId,
    cwd,
    details: completion,
    pending_triggers: getHooksForSkill(completion.skill, completion.type),
  };

  writeJson(triggerFile, trigger);
  console.error(`Skill trigger created: ${completion.skill} -> ${trigger.pending_triggers.map((t) => t.trigger).join(", ") || "none"}`);
}

function getHooksForSkill(skillName, completionType) {
  // Define hooks based on skill completion
  const hookDefinitions = {
    "prd-planner": {
      after_complete: [
        { trigger: "self-improving-agent", mode: "background" },
        { trigger: "session-logger", mode: "auto" },
      ],
    },
    "prd-implementation-precheck": {
      after_complete: [
        { trigger: "code-reviewer", mode: "ask_first" },
        { trigger: "self-improving-agent", mode: "background" },
        { trigger: "session-logger", mode: "auto" },
      ],
    },
    "commit-helper": {
      after_complete: [{ trigger: "session-logger", mode: "auto" }],
    },
    "create-pr": {
      after_complete: [{ trigger: "session-logger", mode: "auto" }],
    },
    "code-reviewer": {
      after_complete: [
        { trigger: "self-improving-agent", mode: "background" },
        { trigger: "session-logger", mode: "auto" },
      ],
    },
    "debugger": {
      after_complete: [
        { trigger: "self-improving-agent", mode: "background" },
        { trigger: "session-logger", mode: "auto" },
      ],
    },
    "refactoring-specialist": {
      after_complete: [
        { trigger: "self-improving-agent", mode: "background" },
        { trigger: "session-logger", mode: "auto" },
      ],
    },
    "test-automator": {
      after_complete: [{ trigger: "session-logger", mode: "auto" }],
    },
    "self-improving-agent": {
      after_complete: [
        { trigger: "create-pr", mode: "ask_first", condition: "skills_modified" },
        { trigger: "session-logger", mode: "auto" },
      ],
    },
  };

  const hooks = hookDefinitions[skillName];
  if (!hooks) {
    return [];
  }

  // Return after_complete hooks by default
  return hooks.after_complete || [];
}

function handleSkills(options, positionals, context) {
  const settings = resolveSettings(options, context || {});
  const subcommand = positionals[0] || "list";
  const args = positionals.slice(1);

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
      return Promise.resolve();
  }
}

function resolveSettings(options, context) {
  const cwd = process.cwd();
  const repoRootDetected = options.repo ? path.resolve(options.repo) : findRepoRoot(cwd);
  const cliRoot =
    context && context.cliPath ? path.resolve(path.dirname(context.cliPath), "..") : null;
  const skillsSource = resolveSkillsSource([repoRootDetected || cwd, cliRoot]);
  const projectMode = Boolean(options.project);

  const envClaudeDir = process.env.AGENT_PLAYBOOK_CLAUDE_DIR;
  const envCodexDir = process.env.AGENT_PLAYBOOK_CODEX_DIR;
  const envGeminiDir = process.env.AGENT_PLAYBOOK_GEMINI_DIR;
  const globalClaudeDir = envClaudeDir ? path.resolve(envClaudeDir) : path.join(os.homedir(), ".claude");
  const globalCodexDir = envCodexDir ? path.resolve(envCodexDir) : path.join(os.homedir(), ".codex");
  const globalGeminiDir = envGeminiDir ? path.resolve(envGeminiDir) : path.join(os.homedir(), ".gemini");
  const projectRoot = repoRootDetected || cwd;
  const projectClaudeDir = repoRootDetected ? path.join(repoRootDetected, ".claude") : null;
  const projectCodexDir = repoRootDetected ? path.join(repoRootDetected, ".codex") : null;
  const projectGeminiDir = repoRootDetected ? path.join(repoRootDetected, ".gemini") : null;
  const claudeDir = projectMode ? path.join(projectRoot, ".claude") : globalClaudeDir;
  const codexDir = projectMode ? path.join(projectRoot, ".codex") : globalCodexDir;
  const geminiDir = projectMode ? path.join(projectRoot, ".gemini") : globalGeminiDir;

  return {
    cwd,
    repoRoot: repoRootDetected || cwd,
    repoRootDetected,
    skillsSource,
    projectMode,
    cliPath: context && context.cliPath ? context.cliPath : null,
    claudeDir,
    codexDir,
    geminiDir,
    globalClaudeDir,
    globalCodexDir,
    globalGeminiDir,
    projectClaudeDir,
    projectCodexDir,
    projectGeminiDir,
    claudeSkillsDir: path.join(claudeDir, SKILLS_DIR_NAME),
    codexSkillsDir: path.join(codexDir, SKILLS_DIR_NAME),
    geminiSkillsDir: path.join(geminiDir, SKILLS_DIR_NAME),
    claudeSettingsPath: path.join(claudeDir, "settings.json"),
    codexConfigPath: path.join(codexDir, "config.toml"),
    statePath: path.join(globalClaudeDir, LOCAL_CLI_DIR, STATE_FILE_NAME),
  };
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
        }
      : null,
    global: {
      claude: path.join(settings.globalClaudeDir, SKILLS_DIR_NAME),
      codex: path.join(settings.globalCodexDir, SKILLS_DIR_NAME),
      gemini: path.join(settings.globalGeminiDir, SKILLS_DIR_NAME),
    },
  };

  return {
    projectRoot,
    scopeDirs,
    statePath: settings.statePath,
    skillsSource: settings.skillsSource,
  };
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
    warnings.push(`Unknown scope "${scopeValue}", defaulting to both.`);
    scopes = ["project", "global"];
  }

  if (!projectRoot) {
    if (scopes.includes("project")) {
      warnings.push("Project scope requested but no repo root detected; skipping project scope.");
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
    targets = ["claude", "codex", "gemini"];
  } else if (value === "claude" || value === "codex" || value === "gemini") {
    targets = [value];
  } else {
    warnings.push(`Unknown target "${targetValue}", defaulting to all.`);
    targets = ["claude", "codex", "gemini"];
  }
  return { targets, warnings };
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
    version: "1",
    updated_at: new Date().toISOString(),
    skills: [],
  };
}

function loadStateFile(statePath) {
  if (!fs.existsSync(statePath)) {
    return createEmptyState();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid state file");
    }
    if (!Array.isArray(parsed.skills)) {
      parsed.skills = [];
    }
    if (!parsed.version) {
      parsed.version = "1";
    }
    if (!parsed.updated_at) {
      parsed.updated_at = new Date().toISOString();
    }
    return parsed;
  } catch (error) {
    console.error("Warning: unable to parse state.json, recreating state file.");
    return createEmptyState();
  }
}

function saveStateFile(statePath, state, dryRun) {
  if (dryRun) {
    return;
  }
  ensureDir(path.dirname(statePath), false);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function stateKey(name, scope, target) {
  return `${target}:${scope}:${name}`;
}

function indexStateEntries(state) {
  const map = new Map();
  (state.skills || []).forEach((entry) => {
    if (!entry || !entry.name) {
      return;
    }
    map.set(stateKey(entry.name, entry.scope, entry.target), entry);
  });
  return map;
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
    return { name: path.basename(skillDir), sourceDir: skillDir, kind: "path" };
  }

  const skillsSource = env.skillsSource;
  if (!skillsSource) {
    return { error: "No bundled skills directory found. Use a local path instead." };
  }

  const candidate = path.join(skillsSource, input);
  if (!fs.existsSync(path.join(candidate, "SKILL.md"))) {
    const available = listBuiltInSkills(skillsSource);
    const sample = available.length ? ` Available: ${available.join(", ")}` : "";
    return { error: `Skill "${input}" not found in bundled skills.${sample}` };
  }

  return { name: input, sourceDir: candidate, kind: "name" };
}

function scanSkills(scopeDirs, scopes, targets, stateIndex) {
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
      records.push(...scanSkillDir(dirPath, scope, target, stateIndex));
    });
  });

  markDuplicates(records);
  return { records, warnings };
}

function scanSkillDir(dirPath, scope, target, stateIndex) {
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
    records.push(buildSkillRecord(entry.name, path.join(dirPath, entry.name), scope, target, false, stateIndex));
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
        buildSkillRecord(entry.name, path.join(disabledDir, entry.name), scope, target, true, stateIndex)
      );
    });
  }

  return records;
}

function buildSkillRecord(name, entryPath, scope, target, disabled, stateIndex) {
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
    const entry = stateIndex.get(stateKey(name, scope, target));
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
  const scan = scanSkills(env.scopeDirs, scopeInfo.scopes, targetInfo.targets, stateIndex);
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

  const scan = scanSkills(env.scopeDirs, scopeInfo.scopes, targetInfo.targets, stateIndex);
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
  const scan = scanSkills(env.scopeDirs, scopeInfo.scopes, targetInfo.targets, stateIndex);
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

      const key = stateKey(resolved.name, scope, target);
      const entry = stateIndex.get(key) || {
        name: resolved.name,
        scope,
        target,
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
    const stateKeys = Array.from(stateIndex.keys()).filter((key) => key.endsWith(`:${name}`));
    if (stateKeys.length) {
      stateKeys.forEach((key) => stateIndex.delete(key));
      state.skills = Array.from(stateIndex.values());
      state.updated_at = new Date().toISOString();
      saveStateFile(env.statePath, state, options["dry-run"]);
      console.log(`Removed ${stateKeys.length} state entries for "${name}".`);
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
    const key = stateKey(match.name, match.scope, match.target);
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

    const key = stateKey(match.name, match.scope, match.target);
    const entry = stateIndex.get(key);
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

    const key = stateKey(match.name, match.scope, match.target);
    const entry = stateIndex.get(key);
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
  const scan = scanSkills(env.scopeDirs, scopeInfo.scopes, targetInfo.targets, stateIndex);

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
    const activePath = path.join(root, entry.name);
    let sourceDir = entry.source;
    if (sourceRoot) {
      const candidate = path.join(sourceRoot, entry.name);
      if (fs.existsSync(path.join(candidate, "SKILL.md"))) {
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
    fs.writeFileSync(resolved, JSON.stringify(state, null, 2));
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
  const state = {
    version: imported.version || "1",
    updated_at: now,
    skills: skills,
  };

  let applied = 0;
  let skipped = 0;
  skills.forEach((entry) => {
    if (!entry || !entry.name || !entry.scope || !entry.target) {
      skipped += 1;
      return;
    }
    if (entry.disabled) {
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
    const targetPath = path.join(root, entry.name);
    let sourceDir = entry.source;
    if (options.source) {
      const candidate = path.join(path.resolve(options.source), entry.name);
      if (fs.existsSync(path.join(candidate, "SKILL.md"))) {
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
      mode: entry.mode || defaultMode,
      dryRun: options["dry-run"],
    });
    entry.updated_at = now;
    applied += 1;
  });

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

  let sessionCommand = buildHookCommand(cliPath, "session-log");
  sessionCommand = `${sessionCommand} --hook-source ${HOOK_SOURCE_VALUE}`;
  if (options["session-dir"]) {
    const sessionDir = path.resolve(options["session-dir"]);
    sessionCommand = `${sessionCommand} --session-dir \"${sessionDir}\"`;
  }
  const improveCommand = `${buildHookCommand(cliPath, "self-improve")} --hook-source ${HOOK_SOURCE_VALUE}`;

  ensureHook(data.hooks, "SessionEnd", null, sessionCommand);
  ensureHook(data.hooks, "PostToolUse", "*", improveCommand);

  data.agentPlaybook = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    cliPath,
  };

  if (!options["dry-run"]) {
    backupFile(settingsPath);
    ensureDir(path.dirname(settingsPath), false);
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
  }
  return true;
}

function removeHooks(settings) {
  const settingsPath = settings.claudeSettingsPath;
  const data = readJsonSafe(settingsPath);
  if (!data || !data.hooks) {
    return;
  }

  const marker = `--hook-source ${HOOK_SOURCE_VALUE}`;
  data.hooks = removeHookCommand(data.hooks, "SessionEnd", marker);
  data.hooks = removeHookCommand(data.hooks, "PostToolUse", marker);

  delete data.agentPlaybook;

  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
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
  fs.writeFileSync(configPath, updated);
}

function removeCodexConfig(settings) {
  const configPath = settings.codexConfigPath;
  if (!fs.existsSync(configPath)) {
    return;
  }
  const content = fs.readFileSync(configPath, "utf8");
  const cleaned = removeCodexBlock(content);
  fs.writeFileSync(configPath, cleaned);
}

function removeLocalCli(settings) {
  const cliRoot = path.join(settings.claudeDir, LOCAL_CLI_DIR);
  if (fs.existsSync(cliRoot)) {
    fs.rmSync(cliRoot, { recursive: true, force: true });
  }
}

function removeLinks(links) {
  links.forEach((link) => {
    if (!link || !link.target) {
      return;
    }
    safeUnlink(link.target);
  });
}

function ensureHook(hooks, eventName, matcher, command) {
  hooks[eventName] = hooks[eventName] || [];
  const entries = hooks[eventName];

  let entry = entries.find((item) => (matcher ? item.matcher === matcher : !item.matcher));
  if (!entry) {
    entry = matcher ? { matcher, hooks: [] } : { hooks: [] };
    entries.push(entry);
  }

  entry.hooks = entry.hooks || [];
  const exists = entry.hooks.some((hook) => hook.command === command);
  if (!exists) {
    entry.hooks.push({ type: "command", command });
  }
}

function removeHookCommand(hooks, eventName, command) {
  const entries = hooks[eventName];
  if (!entries) {
    return hooks;
  }

  hooks[eventName] = entries
    .map((entry) => {
      const nextHooks = (entry.hooks || []).filter((hook) => !String(hook.command || "").includes(command));
      return { ...entry, hooks: nextHooks };
    })
    .filter((entry) => (entry.hooks || []).length > 0);

  if (!hooks[eventName].length) {
    delete hooks[eventName];
  }

  return hooks;
}

function upsertCodexBlock(content, values) {
  const cleaned = removeCodexBlock(content);
  const lines = [
    cleaned.trimEnd(),
    "",
    "[agent_playbook]",
    `version = \"${values.version}\"`,
    `installed_at = \"${values.installed_at}\"`,
    "",
  ];
  return lines.join("\n");
}

function removeCodexBlock(content) {
  const pattern = /^\[agent_playbook\][\s\S]*?(?=^\[|\s*$)/gm;
  const cleaned = content.replace(pattern, "");
  const legacyPattern =
    /(?:\n\s*version\s*=\s*\"[^\"]*\"\s*\n\s*installed_at\s*=\s*\"[^\"]*\"\s*)+$/;
  return cleaned.replace(legacyPattern, "\n").trimEnd();
}

function buildHookCommand(cliPath, subcommand) {
  const quoted = cliPath.includes(" ") ? `\"${cliPath}\"` : cliPath;
  return `${quoted} ${subcommand}`;
}

function resolveSessionDir(explicit, cwd) {
  if (explicit) {
    return path.resolve(explicit);
  }

  const repoRoot = findRepoRoot(cwd);
  if (repoRoot) {
    return path.join(repoRoot, DEFAULT_SESSION_DIR);
  }

  return path.join(os.homedir(), ".claude", DEFAULT_SESSION_DIR);
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

function collectTranscriptInsights(events) {
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
    const text = extractEventText(event);

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

function buildSessionSummary(insights, sessionId, cwd) {
  const now = new Date();
  const date = formatDate(now);
  const repoRoot = findRepoRoot(cwd) || cwd;
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
    `**Context**: ${repoRoot}`,
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
    `Session ID: ${sessionId}`,
    `Working directory: ${cwd}`,
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
  return {
    skillsSource: settings.skillsSource,
    claudeSettingsPath: settings.claudeSettingsPath,
    codexConfigPath: settings.codexConfigPath,
    claudeSkillsDir: settings.claudeSkillsDir,
    codexSkillsDir: settings.codexSkillsDir,
    geminiSkillsDir: settings.geminiSkillsDir,
    claudeSettingsReadable: claudeSettings !== null || !fs.existsSync(settings.claudeSettingsPath),
    codexBlockPresent: hasCodexBlock(settings.codexConfigPath),
    hooksInstalled: hasHooks(settings.claudeSettingsPath),
    manifestPresent: fs.existsSync(path.join(settings.claudeSkillsDir, ".agent-playbook.json")),
    localCliPresent: fs.existsSync(path.join(settings.claudeDir, LOCAL_CLI_DIR, "bin", "agent-playbook.js")),
    claudeSkillCount: countSkills(settings.claudeSkillsDir),
    codexSkillCount: countSkills(settings.codexSkillsDir),
    geminiSkillCount: countSkills(settings.geminiSkillsDir),
  };
}

function hasHooks(settingsPath) {
  const data = readJsonSafe(settingsPath);
  if (!data || !data.hooks) {
    return false;
  }
  const sessionHook = (data.hooks.SessionEnd || []).some((entry) =>
    (entry.hooks || []).some((hook) => String(hook.command || "").includes("session-log"))
  );
  const improveHook = (data.hooks.PostToolUse || []).some((entry) =>
    (entry.hooks || []).some((hook) => String(hook.command || "").includes("self-improve"))
  );
  return sessionHook && improveHook;
}

function summarizeIssues(status) {
  const issues = [];
  if (!status.skillsSource) {
    issues.push("skills source not found (run init from repo or use --repo)");
  }
  if (!status.claudeSettingsReadable) {
    issues.push("unable to parse ~/.claude/settings.json");
  }
  if (!status.manifestPresent) {
    issues.push("missing Claude skill manifest (.agent-playbook.json)");
  }
  if (!status.hooksInstalled) {
    issues.push("Claude hooks not installed");
  }
  if (!status.localCliPresent) {
    issues.push("Claude local CLI not installed under ~/.claude/agent-playbook");
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
  console.log(`- Claude skills count: ${status.claudeSkillCount}`);
  console.log(`- Codex skills count: ${status.codexSkillCount}`);
  console.log(`- Gemini skills count: ${status.geminiSkillCount}`);
  console.log(`- Claude hooks installed: ${status.hooksInstalled ? "yes" : "no"}`);
  console.log(`- Claude manifest present: ${status.manifestPresent ? "yes" : "no"}`);
  console.log(`- Claude local CLI present: ${status.localCliPresent ? "yes" : "no"}`);
  console.log(`- Codex config block: ${status.codexBlockPresent ? "yes" : "no"}`);
}

function printInitSummary(settings, hooksEnabled, options, claudeLinks, codexLinks, geminiLinks, warnings) {
  console.log("Init complete.");
  console.log(`- Claude skills: ${settings.claudeSkillsDir}`);
  console.log(`- Codex skills: ${settings.codexSkillsDir}`);
  console.log(`- Gemini skills: ${settings.geminiSkillsDir}`);
  console.log(`- Hooks: ${hooksEnabled ? "enabled" : "disabled"}`);
  const linkedCount =
    claudeLinks.created.length + codexLinks.created.length + (geminiLinks ? geminiLinks.created.length : 0);
  console.log(`- Linked skills: ${linkedCount}`);
  const overwrittenCount =
    (claudeLinks.overwritten ? claudeLinks.overwritten.length : 0) +
    (codexLinks.overwritten ? codexLinks.overwritten.length : 0) +
    (geminiLinks && geminiLinks.overwritten ? geminiLinks.overwritten.length : 0);
  if (overwrittenCount) {
    console.log(`- Overwritten skills: ${overwrittenCount}`);
  }
  if (
    claudeLinks.skipped.length ||
    codexLinks.skipped.length ||
    (geminiLinks && geminiLinks.skipped.length)
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
  items.forEach((item) => {
    const value = String(item || "").trim();
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    result.push(value);
    if (limit && result.length >= limit) {
      return;
    }
  });
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

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
  const status = collectStatus(settings);
  const warnings = [];
  const overwriteState = createOverwriteState(options);

  if (!settings.skillsSource) {
    warnings.push("Skills directory not found; skipping skill linking.");
  }

  if (!options["dry-run"]) {
    ensureDir(settings.claudeSkillsDir, false);
    ensureDir(settings.codexSkillsDir, false);
    ensureDir(settings.geminiSkillsDir, false);
  }

  if (!status.localCliPresent) {
    ensureLocalCli(settings, context, options);
  }

  if (!status.hooksInstalled) {
    const updated = updateClaudeSettings(
      settings,
      path.join(settings.claudeDir, LOCAL_CLI_DIR, "bin", "agent-playbook.js"),
      options
    );
    if (updated === false) {
      warnings.push("Unable to update Claude settings (invalid JSON).");
    }
  }

  if (!status.codexBlockPresent) {
    updateCodexConfig(settings, options);
  }

  if (settings.skillsSource) {
    linkSkills(settings.skillsSource, settings.claudeSkillsDir, options, overwriteState);
    linkSkills(settings.skillsSource, settings.codexSkillsDir, options, overwriteState);
    linkSkills(settings.skillsSource, settings.geminiSkillsDir, options, overwriteState);
    if (!options["dry-run"]) {
      const manifestPath = path.join(settings.claudeSkillsDir, ".agent-playbook.json");
      if (!fs.existsSync(manifestPath)) {
        writeJson(manifestPath, {
          name: APP_NAME,
          version: VERSION,
          installedAt: new Date().toISOString(),
          repairedAt: new Date().toISOString(),
          repoRoot: settings.repoRoot,
          links: { claude: [], codex: [], gemini: [] },
        });
      }
    }
  }

  printInitSummary(
    settings,
    true,
    options,
    { created: [], skipped: [] },
    { created: [], skipped: [] },
    { created: [], skipped: [] },
    warnings
  );
  return Promise.resolve();
}

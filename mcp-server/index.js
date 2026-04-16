#!/usr/bin/env node

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import YAML from "yaml";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const MODULE_PATH = fileURLToPath(import.meta.url);
const __dirname = path.dirname(MODULE_PATH);
const SKILLS_DIR = path.join(__dirname, "../skills");
const CATALOG_PATH = path.join(SKILLS_DIR, "catalog.json");
const SKILL_FILE_NAME = "SKILL.md";
const DEFAULT_CATEGORY = "other";
const CATEGORY_MAP = loadSkillCatalog();
const CATEGORY_NAMES = Object.keys(CATEGORY_MAP);

const server = new Server(
  {
    name: "agent-playbook-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_skills",
      description: "List all available Claude Code skills in agent-playbook",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: `Filter by category (${CATEGORY_NAMES.join(", ")})`,
            enum: CATEGORY_NAMES,
          },
        },
      },
    },
    {
      name: "get_skill",
      description: "Get the content of a specific skill including its description and usage",
      inputSchema: {
        type: "object",
        properties: {
          skill_name: {
            type: "string",
            description: "Name of the skill (e.g., prd-planner, debugger, code-reviewer)",
          },
          include_content: {
            type: "boolean",
            description: "Whether to include the full skill file content",
            default: false,
          },
        },
        required: ["skill_name"],
      },
    },
    {
      name: "search_skills",
      description: "Search for skills by keyword in name, description, or category",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find matching skills",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_skill_hooks",
      description: "Get the hook configuration for a skill",
      inputSchema: {
        type: "object",
        properties: {
          skill_name: {
            type: "string",
            description: "Name of the skill",
          },
        },
        required: ["skill_name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_skills": {
      const skills = await listSkills(args?.category);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(skills, null, 2),
          },
        ],
      };
    }

    case "get_skill": {
      const skill = await getSkill(args.skill_name, args?.include_content);
      return {
        content: [
          {
            type: "text",
            text: skill,
          },
        ],
      };
    }

    case "search_skills": {
      const results = await searchSkills(args.query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    case "get_skill_hooks": {
      const hooks = await getSkillHooks(args.skill_name);
      return {
        content: [
          {
            type: "text",
            text: hooks,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

function loadSkillCatalog(catalogPath = CATALOG_PATH) {
  const raw = fsSync.readFileSync(catalogPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function extractFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    return null;
  }
  const parsed = YAML.parse(match[1]);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function extractMainContent(content) {
  const match = content.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  if (!match) {
    return content;
  }
  return content.slice(match[0].length).trimStart();
}

function normalizeStringList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedTools(frontMatter) {
  return normalizeStringList(frontMatter?.["allowed-tools"] || frontMatter?.allowed_tools);
}

function getSkillHooksFromFrontMatter(frontMatter) {
  const hooks = frontMatter?.metadata?.hooks || frontMatter?.hooks || null;
  return hooks && typeof hooks === "object" ? hooks : null;
}

function getSkillCategory(skillName, categoryMap = CATEGORY_MAP) {
  for (const [category, skills] of Object.entries(categoryMap)) {
    if (Array.isArray(skills) && skills.includes(skillName)) {
      return category;
    }
  }
  return DEFAULT_CATEGORY;
}

async function readSkill(skillName, skillsDir = SKILLS_DIR) {
  const possiblePaths = [path.join(skillsDir, skillName, SKILL_FILE_NAME), path.join(skillsDir, `${skillName}.md`)];

  for (const skillPath of possiblePaths) {
    try {
      const content = await fs.readFile(skillPath, "utf8");
      const frontMatter = extractFrontMatter(content);
      if (!frontMatter) {
        continue;
      }
      return {
        skillPath,
        content,
        frontMatter,
      };
    } catch {
      // Try the next location.
    }
  }

  return null;
}

async function listSkills(category, options = {}) {
  const skillsDir = options.skillsDir || SKILLS_DIR;
  const categoryMap = options.categoryMap || CATEGORY_MAP;
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "reference") {
      continue;
    }

    const skill = await readSkill(entry.name, skillsDir);
    if (!skill) {
      continue;
    }

    const skillCategory = getSkillCategory(entry.name, categoryMap);
    if (category && skillCategory !== category) {
      continue;
    }

    skills.push({
      name: skill.frontMatter.name || entry.name,
      description: skill.frontMatter.description || "",
      category: skillCategory,
      path: skill.skillPath,
      allowed_tools: getAllowedTools(skill.frontMatter),
    });
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

async function getSkill(skillName, includeContent = false, options = {}) {
  const skillsDir = options.skillsDir || SKILLS_DIR;
  const skill = await readSkill(skillName, skillsDir);

  if (!skill) {
    return JSON.stringify({ error: `Skill '${skillName}' not found` }, null, 2);
  }

  const result = {
    name: skill.frontMatter.name || skillName,
    description: skill.frontMatter.description || "",
    allowed_tools: getAllowedTools(skill.frontMatter),
    hooks: getSkillHooksFromFrontMatter(skill.frontMatter),
  };

  if (includeContent) {
    result.full_content = skill.content;
    result.main_content = extractMainContent(skill.content);
  }

  return JSON.stringify(result, null, 2);
}

async function searchSkills(query, options = {}) {
  const allSkills = await listSkills(null, options);
  const lowerQuery = String(query || "").toLowerCase();

  return allSkills.filter((skill) => {
    return (
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.category.toLowerCase().includes(lowerQuery)
    );
  });
}

async function getSkillHooks(skillName, options = {}) {
  const skillData = await getSkill(skillName, false, options);
  const parsed = JSON.parse(skillData);

  if (parsed.error) {
    return JSON.stringify({ error: parsed.error }, null, 2);
  }

  if (parsed.hooks && Object.keys(parsed.hooks).length > 0) {
    return JSON.stringify(
      {
        skill: parsed.name,
        hooks: parsed.hooks,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      skill: parsed.name,
      hooks: null,
      message: "This skill has no hook configuration defined",
    },
    null,
    2
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Playbook MCP Server running on stdio");
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export {
  CATALOG_PATH,
  CATEGORY_MAP,
  CATEGORY_NAMES,
  SKILLS_DIR,
  extractFrontMatter,
  getSkill,
  getSkillCategory,
  getSkillHooks,
  listSkills,
  loadSkillCatalog,
  searchSkills,
};

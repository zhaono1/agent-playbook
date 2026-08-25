"use strict";

const BLOCK_START = "# BEGIN agent-playbook";
const BLOCK_END = "# END agent-playbook";

function isTableHeader(line) {
  return /^\s*(?:\[\[[^\r\n]+\]\]|\[[^\r\n]+\])\s*(?:#.*)?$/.test(line);
}

function removeCodexBlock(content) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const kept = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed === BLOCK_START) {
      let end = index + 1;
      while (end < lines.length && lines[end].trim() !== BLOCK_END) {
        end += 1;
      }
      if (end >= lines.length) {
        const error = new Error(`Malformed Codex config: missing ${BLOCK_END}.`);
        error.code = "APB_MALFORMED_CODEX_BLOCK";
        throw error;
      }
      index = end;
      continue;
    }

    if (trimmed === "[agent_playbook]") {
      let end = index + 1;
      while (end < lines.length && !isTableHeader(lines[end])) {
        end += 1;
      }
      index = end - 1;
      continue;
    }

    kept.push(lines[index]);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function upsertCodexBlock(content, values) {
  const cleaned = removeCodexBlock(content);
  const block = [
    BLOCK_START,
    "[agent_playbook]",
    `version = "${values.version}"`,
    `installed_at = "${values.installed_at}"`,
    BLOCK_END,
  ].join("\n");
  return `${cleaned ? `${cleaned}\n\n` : ""}${block}\n`;
}

module.exports = {
  BLOCK_END,
  BLOCK_START,
  removeCodexBlock,
  upsertCodexBlock,
};

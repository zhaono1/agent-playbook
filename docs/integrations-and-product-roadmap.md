# Integrations and Product Roadmap

Agent Playbook is most useful as a small local control plane around portable
skills—not as another general-purpose agent runtime.

## Product Boundary

```text
portable skills + evals
          ↓
local lifecycle core (install, capture, review, export)
          ↓
host adapters (Claude, Codex, Gemini, DeepSeek Harness)
          ↓
knowledge sinks (files, Obsidian, future connectors)
```

The core owns schemas, privacy, candidate state, validation gates, and exports.
Adapters translate documented host events into the core contract. Sinks receive
derived output and never become the only source of truth.

## Obsidian Integration

An Obsidian vault is a local directory of Markdown files, so the safe integration
is file-based and does not require storing private vault details in a skill.

1. Keep candidate state outside the vault.
1. Promote only validated rules.
1. Export a stable notebook file into the vault:

```bash
apb self-improve export --output /path/to/vault/Agent/Learning.md
```

1. Run the same idempotent command periodically with the operating system's
   scheduler or an authorized automation host.

This supports an implicit “错题本” without copying raw conversations into the
vault. Additional permanent notes can link to candidate ids, while project facts
stay in their project-owned documents.

## DeepSeek Harness Integration

DeepSeek Harness currently discovers skills from project `.dsh/skills` and user
`~/.dsh/skills` directories. Agent Playbook v0.4 installs to those directories:

```bash
apb skills add ./skills/self-improving-agent --target dsh --scope project
# `--target deepseek` is an alias
```

`apb init` also includes the DeepSeek Harness target when installing all skills.

For a native Harness plugin, keep the adapter thin:

1. Package an Agent Playbook bundle/profile for distribution.
2. Register the skill directory with the documented skill provider API.
3. Translate documented failure or lifecycle events into the CLI event envelope.
4. Delegate candidate storage, redaction, review, and export to the core.
5. Add compatibility tests against a pinned Harness version because the project
   is still a developer preview and may introduce breaking changes.

Do not fork the learning state machine into the plugin. The plugin should contain
host discovery and event translation only.

References:

- [DeepSeek Harness skills subsystem](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md)
- [DeepSeek Harness skill API](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/skill/README.md)
- [DeepSeek Harness bundle publishing](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)

## Productization Plan

### v0.4 — Trustworthy Local Core

- Privacy-safe failure capture and candidate deduplication
- Explicit validation and promotion lifecycle
- Obsidian-compatible Markdown export
- DeepSeek Harness skill distribution
- Representative CLI tests and skill eval cases

Success means a user can reproduce the entire loop locally without granting a
cloud service transcript access.

### v0.5 — Thin Host Adapters

- Publish a versioned DeepSeek Harness bundle/profile
- Add documented Codex and Gemini event adapters only where host APIs support them
- Add schema migration and import/export compatibility tests
- Add an idempotent scheduler recipe for knowledge exports

Success means adapters share the same conformance fixtures and never implement
their own learning policy.

### v1.0 — Team-Ready Distribution

- Signed/versioned skill packs and a compatibility matrix
- Review queues with local or bring-your-own storage
- Opt-in aggregate metrics that exclude prompts, paths, and content
- Release channels, rollback, and upgrade/migration documentation

Success means teams can audit what was learned, why it was promoted, which host
uses it, and how to roll it back.

## Non-Goals

- Replacing Claude Code, Codex, Gemini, or DeepSeek Harness
- Autonomous edits to durable instructions from a single event
- Storing full transcripts as “memory”
- A proprietary knowledge format that locks users out of local files
- Claiming cross-host hooks that the current host does not document

# Host Conformance

Agent Playbook reports only evidence it can prove locally. Installing a skill
directory is not proof that a host discovered or invoked the skill, and a valid
hook configuration is not proof that a hook ran.

Run the local static check after installation:

```bash
apb conformance
apb conformance --format json
```

The report uses these statuses:

| Status | Meaning |
|---|---|
| `proven` | The local filesystem or configuration contract was inspected and passed. |
| `failed` | A partially installed or configured local contract is invalid. |
| `not-configured` | The optional capability is not installed or enabled. |
| `unsupported` | Agent Playbook does not provide this adapter capability. |
| `unverified` | Proof requires an observed host discovery or runtime invocation. |

`overall: pass` means the installed local-static contracts are internally
consistent. It does not upgrade `unverified` runtime capabilities to `proven`.
The command exits non-zero for `failed` and wholly `not-configured` reports.

## Current Capability Boundary

| Host | Locally provable | Deliberately not claimed |
|---|---|---|
| Claude Code | Skill files; opt-in `SessionEnd` and `PostToolUseFailure` handlers using command-plus-args; managed local CLI exists | Host skill discovery and actual hook invocation |
| Codex | Skill files; Agent Playbook's own TOML ownership marker | Lifecycle adapter, host discovery, and invocation |
| Gemini CLI | Skill files | Lifecycle adapter, host discovery, and invocation |
| DeepSeek Harness | Skill files | Lifecycle adapter, host discovery, and invocation |

The Claude handler uses an executable plus an argument array and does not request
a shell. This follows Claude Code's documented command-hook form and prevents
paths or option values from being interpreted as shell syntax. Hook installation
remains opt-in with `apb init --hooks`.

## Runtime Proof

A future host adapter can turn `host_discovery` or `runtime_invocation` into
`proven` only when it records a bounded, versioned observation from that host.
Filesystem installation alone must never satisfy those checks. Runtime evidence
must also follow the existing privacy rule: do not persist raw prompts, tool
inputs, tool outputs, or transcripts merely to prove invocation.

Primary contracts:

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [OpenAI skill-building documentation](https://learn.chatgpt.com/docs/build-skills)

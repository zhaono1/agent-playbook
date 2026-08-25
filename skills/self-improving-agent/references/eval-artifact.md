# Executable Eval Artifact

Validation uses a local JSON artifact that runs falsifiable baseline and candidate
scenarios. It replaces free-form validation evidence with a result the CLI can
execute and verify.

## Schema

```json
{
  "schema_version": "1",
  "candidate_id": "cand-...",
  "name": "Representative behavior regression",
  "scenarios": [
    {
      "id": "baseline-reproduces",
      "phase": "baseline",
      "cwd": "../baseline-worktree",
      "command": ["node", "--test", "test/behavior.test.js"],
      "timeout_ms": 30000,
      "expect": {
        "exit_code": 1,
        "stderr_includes": ["expected failure"]
      }
    },
    {
      "id": "candidate-fixes",
      "phase": "candidate",
      "cwd": "../candidate-worktree",
      "command": ["node", "--test", "test/behavior.test.js"],
      "expect": {
        "exit_code": 0,
        "stdout_excludes": ["regression"]
      }
    }
  ]
}
```

- `schema_version` must be `"1"`.
- `candidate_id` must match the candidate being evaluated.
- `scenarios` contains 1–20 unique entries and must include at least one
  `candidate` phase. A `baseline` phase is optional but recommended when the old
  behavior can be reproduced safely.
- `command` is an argument array. Shell command strings are rejected.
- Relative `cwd` values resolve from the artifact directory.
- `timeout_ms` defaults to 30 seconds and may not exceed 5 minutes.
- Expectations support `exit_code`, `stdout_includes`, `stdout_excludes`,
  `stderr_includes`, and `stderr_excludes`.

## Run and Validate

```bash
apb self-improve eval cand-... --artifact behavior-eval.json
apb self-improve review cand-... \
  --decision validate \
  --reason "baseline reproduced and candidate scenarios passed" \
  --eval-result /path/printed/by/the/eval/command.json
```

The runner does not invoke a shell. Result files are written with mode `0600`
under `~/.agent-playbook/self-improvement/evals/`. They contain scenario status,
assertion booleans, durations, and hashes; raw stdout and stderr are not persisted.
Commands receive a minimal environment containing platform/runtime basics such
as `PATH`, temporary-directory variables, locale, and home-directory variables;
arbitrary parent tokens and credentials are not inherited.
Before validation, the CLI rejects symlinked result paths and recomputes scenario,
summary, and overall pass consistency. This is structural local evidence, not a
cryptographic attestation against the local user who owns the result files.

An eval artifact is executable code authority because its command arrays start
local processes. It is not a sandbox: commands run as the current OS user and can
read accessible files or use the network. Read the artifact before running, keep
it in a reviewed repository, and do not embed secrets in commands or expectations.

#!/usr/bin/env python3
"""Run every documented Python skill command in an isolated directory."""

from __future__ import annotations

import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = REPO_ROOT / "skills"
COMMAND_PATTERN = re.compile(r"^python3\s+scripts/[^\s]+(?:\s+.*)?$")
PLACEHOLDER_VALUES = {
    "environment": "staging",
    "feature": "checkout",
    "resource-name": "widgets",
    "service-name": "checkout-api",
}


def expand_placeholder(token: str) -> str:
    match = re.fullmatch(r"<([^>]+)>", token)
    if not match:
        return token
    return PLACEHOLDER_VALUES.get(match.group(1), "example")


def collect_commands(skill_file: Path) -> list[str]:
    return [
        line.strip()
        for line in skill_file.read_text(encoding="utf-8").splitlines()
        if COMMAND_PATTERN.fullmatch(line.strip())
    ]


def run_command(skill_dir: Path, command: str, work_dir: Path) -> None:
    args = [expand_placeholder(token) for token in shlex.split(command)]
    script_path = (skill_dir / args[1]).resolve()
    if not script_path.is_file() or skill_dir.resolve() not in script_path.parents:
        raise RuntimeError(f"invalid script reference: {command}")
    args[1] = str(script_path)
    for flag in ("--output", "-o", "--input"):
        if flag in args:
            value_index = args.index(flag) + 1
            value = Path(args[value_index])
            if not value.is_absolute():
                args[value_index] = str(work_dir / value)
    if script_path.name == "review_checklist.py":
        if "--base" in args:
            args[args.index("--base") + 1] = "HEAD"
        execution_dir = REPO_ROOT
    else:
        execution_dir = work_dir
    result = subprocess.run(
        args,
        cwd=execution_dir,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        details = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"command failed ({result.returncode}): {command}\n{details}")


def main() -> int:
    failures: list[str] = []
    command_count = 0

    docs = sorted(SKILLS_DIR.glob("*/SKILL.md")) + sorted(SKILLS_DIR.glob("*/README.md"))
    for doc_file in docs:
        commands = collect_commands(doc_file)
        if not commands:
            continue
        with tempfile.TemporaryDirectory(prefix=f"apb-{doc_file.parent.name}-") as temp_dir:
            work_dir = Path(temp_dir)
            for command in commands:
                command_count += 1
                try:
                    run_command(doc_file.parent, command, work_dir)
                except RuntimeError as error:
                    failures.append(f"{doc_file.relative_to(REPO_ROOT)}: {error}")

    if failures:
        print("Skill command validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"Skill command validation passed ({command_count} commands).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

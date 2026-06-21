#!/usr/bin/env python3
"""
Code Review Checklist Generator
Generates a structured review checklist for a given PR or diff.
"""

import argparse
import subprocess
import sys
from pathlib import Path


def run_git(args: list[str], base_branch: str) -> str:
    """Run a git command and fail with a useful error."""
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        message = f"git {' '.join(args)} failed for base '{base_branch}'"
        if detail:
            message += f": {detail}"
        raise RuntimeError(message) from exc


def get_changed_files(base_branch: str = "main") -> list[str]:
    """Get list of changed files."""
    output = run_git(["diff", f"{base_branch}...HEAD", "--name-only"], base_branch)
    return [f.strip() for f in output.strip().split('\n') if f.strip()]


def get_commit_messages(base_branch: str = "main") -> list[str]:
    """Get commit messages in the PR."""
    output = run_git(["log", f"{base_branch}...HEAD", "--oneline"], base_branch)
    return [line.strip() for line in output.strip().split('\n') if line.strip()]


def get_diff(base_branch: str = "main") -> str:
    """Get the full diff."""
    return run_git(["diff", f"{base_branch}...HEAD"], base_branch)


def categorize_file(filename: str) -> str:
    """Categorize file by extension for targeted checks."""
    ext = Path(filename).suffix.lower()
    if ext in {'.ts', '.tsx', '.js', '.jsx'}:
        return 'javascript'
    if ext in {'.py'}:
        return 'python'
    if ext in {'.go'}:
        return 'go'
    if ext in {'.rs'}:
        return 'rust'
    if ext in {'.java', '.kt'}:
        return 'jvm'
    if ext in {'.sql'}:
        return 'sql'
    if ext in {'.yml', '.yaml'}:
        return 'yaml'
    if ext in {'.md', '.rst'}:
        return 'docs'
    return 'general'


def generate_review_checklist(base_branch: str = "main") -> str:
    """Generate a structured review checklist."""
    files = get_changed_files(base_branch)
    commits = get_commit_messages(base_branch)
    diff = get_diff(base_branch)

    if not files:
        return "# No changes found\n\nNo files changed compared to " + base_branch

    lines = ["# Code Review Checklist\n"]

    # Overview
    lines.append("## Overview\n")
    lines.append(f"- **Branch**: {base_branch} → HEAD")
    lines.append(f"- **Files changed**: {len(files)}")
    lines.append(f"- **Commits**: {len(commits)}\n")

    # Commits
    lines.append("### Commits\n")
    for commit in commits:
        lines.append(f"- {commit}")
    lines.append("")

    # Files by category
    categories = {}
    for f in files:
        cat = categorize_file(f)
        categories.setdefault(cat, []).append(f)

    lines.append("## Files to Review\n")
    for cat, cat_files in categories.items():
        lines.append(f"\n### {cat.title()}\n")
        for f in cat_files:
            lines.append(f"- [{f}]")

    # Diff snippet (first 100 lines)
    lines.append("\n## Diff Preview\n")
    lines.append("```diff")
    for line in diff.split('\n')[:100]:
        lines.append(line)
    if len(diff.split('\n')) > 100:
        lines.append("\n... (diff truncated)")
    lines.append("```\n")

    # Review sections
    lines.append("## Review Sections\n")

    # Security check
    lines.append("### 🔒 Security\n")
    if any('secret' in f.lower() or 'config' in f.lower() or 'env' in f.lower() for f in files):
        lines.append("- [ ] **Secrets check**: No hardcoded credentials in config/env files\n")
    lines.append("- [ ] **Input validation**: User input is validated and sanitized\n")
    lines.append("- [ ] **Injection**: No SQL/command injection vulnerabilities\n")
    lines.append("- [ ] **Auth**: Proper authentication/authorization on new endpoints\n")

    # Code quality
    lines.append("\n### 📝 Code Quality\n")
    lines.append("- [ ] **Readability**: Code is clear and understandable\n")
    lines.append("- [ ] **Naming**: Variables/functions are well named\n")
    lines.append("- [ ] **DRY**: No duplicate code\n")
    lines.append("- [ ] **Comments**: Complex logic is explained\n")

    # Testing
    test_files = [f for f in files if 'test' in f.lower() or 'spec' in f.lower()]
    if test_files:
        lines.append(f"\n### 🧪 Testing ({len(test_files)} test files)\n")
    else:
        lines.append("\n### 🧪 Testing\n")
        lines.append("- [ ] **Tests added**: New functionality has tests\n")
    lines.append("- [ ] **Coverage**: Test coverage not decreased\n")
    lines.append("- [ ] **Edge cases**: Edge cases are tested\n")

    # Performance
    lines.append("\n### ⚡ Performance\n")
    lines.append("- [ ] **N+1 queries**: No database queries in loops\n")
    lines.append("- [ ] **Caching**: Appropriate caching where needed\n")
    lines.append("- [ ] **Efficiency**: Efficient algorithms/data structures\n")

    # Documentation
    lines.append("\n### 📚 Documentation\n")
    lines.append("- [ ] **API docs**: Public APIs are documented\n")
    lines.append("- [ ] **README**: README updated if needed\n")
    lines.append("- [ ] **Comments**: Complex logic has comments\n")

    # Breaking changes
    lines.append("\n### ⚠️ Breaking Changes\n")
    lines.append("- [ ] **Documented**: Breaking changes are documented\n")
    lines.append("- [ ] **Migration**: Migration guide provided if needed\n")

    # Approval
    lines.append("\n## Approval\n")
    lines.append("- [ ] **Critical issues**: None\n")
    lines.append("- [ ] **Tests pass**: All tests pass locally\n")
    lines.append("- [ ] **Ready to merge**: No blocking issues\n")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate code review checklist")
    parser.add_argument("--base", default="main", help="Base branch to compare against")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    args = parser.parse_args()

    try:
        checklist = generate_review_checklist(args.base)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.output:
        Path(args.output).write_text(checklist)
        print(f"Checklist written to {args.output}")
    else:
        print(checklist)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

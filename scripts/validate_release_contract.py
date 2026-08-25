#!/usr/bin/env python3
"""Validate cross-file release and runtime documentation contracts."""

from __future__ import annotations

import json
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> int:
    errors: list[str] = []
    cli_package_path = REPO_ROOT / "packages" / "agent-playbook" / "package.json"
    mcp_package_path = REPO_ROOT / "mcp-server" / "package.json"
    mcp_lock_path = REPO_ROOT / "mcp-server" / "package-lock.json"
    cli_version = json.loads(read(cli_package_path))["version"]
    mcp_version = json.loads(read(mcp_package_path))["version"]
    mcp_lock_version = json.loads(read(mcp_lock_path))["packages"][""]["version"]

    mcp_source = read(REPO_ROOT / "mcp-server" / "index.js")
    match = re.search(r'const SERVER_VERSION = "([^"]+)";', mcp_source)
    server_version = match.group(1) if match else None
    versions = {
        "CLI package": cli_version,
        "MCP package": mcp_version,
        "MCP lock": mcp_lock_version,
        "MCP server": server_version,
    }
    if len(set(versions.values())) != 1:
        errors.append(f"release versions differ: {versions}")

    changelog = read(REPO_ROOT / "CHANGELOG.md")
    if f"## {cli_version} -" not in changelog:
        errors.append(f"CHANGELOG.md has no release entry for {cli_version}")

    root_license = REPO_ROOT / "LICENSE"
    package_license = REPO_ROOT / "packages" / "agent-playbook" / "LICENSE"
    if not root_license.exists() or read(root_license) != read(package_license):
        errors.append("root and npm package MIT license files must match")

    contract_docs = [
        REPO_ROOT / "README.md",
        REPO_ROOT / "README.zh-CN.md",
        REPO_ROOT / "packages" / "agent-playbook" / "README.md",
    ]
    for doc_path in contract_docs:
        text = read(doc_path)
        for required in ("--decision validate", "--decision apply"):
            if required not in text:
                errors.append(f"{doc_path.relative_to(REPO_ROOT)} missing {required}")

    markdown_paths = [
        path
        for path in REPO_ROOT.rglob("*.md")
        if "node_modules" not in path.parts and ".git" not in path.parts
    ]
    banned = ("--decision promote", "--validated", "privacy-safe")
    for doc_path in markdown_paths:
        text = read(doc_path)
        for token in banned:
            if token in text:
                errors.append(f"{doc_path.relative_to(REPO_ROOT)} contains legacy contract {token}")

    if errors:
        print("Release contract validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Release contract validation passed ({cli_version}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

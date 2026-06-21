#!/usr/bin/env python3
# Lightweight secret scanner for common patterns.

from pathlib import Path
import argparse
import re

DEFAULT_IGNORE_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".claude",
    ".codex",
    ".gemini",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "sessions",
}

PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"AIza[0-9A-Za-z_-]{35}"),
    re.compile(r"sk-[0-9A-Za-z]{20,}"),
]


def is_text_file(path: Path, max_bytes: int) -> bool:
    try:
        if path.stat().st_size > max_bytes:
            return False
        data = path.read_bytes()
    except OSError:
        return False
    return b"\x00" not in data


def iter_files(root: Path, ignored_dirs: set[str]):
    if root.is_file():
        yield root
        return

    for file_path in root.rglob("*"):
        if any(part in ignored_dirs for part in file_path.parts):
            continue
        if file_path.is_file():
            yield file_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan for common secret patterns.")
    parser.add_argument("path", nargs="?", default=".", help="Path to scan")
    parser.add_argument("--max-bytes", type=int, default=1_000_000, help="Skip files larger than this")
    parser.add_argument(
        "--ignore-dir",
        action="append",
        default=[],
        help="Directory name to ignore; can be repeated",
    )
    args = parser.parse_args()

    root = Path(args.path)
    if not root.exists():
        print("Path not found: " + str(root))
        return 1

    matches = []
    ignored_dirs = DEFAULT_IGNORE_DIRS | set(args.ignore_dir)
    for file_path in iter_files(root, ignored_dirs):
        if file_path.suffix in {".png", ".jpg", ".jpeg", ".gif", ".pdf"}:
            continue
        if not is_text_file(file_path, args.max_bytes):
            continue
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        for pattern in PATTERNS:
            if pattern.search(text):
                matches.append(str(file_path))
                break

    if matches:
        print("Potential secrets found:")
        for match in matches:
            print("- " + match)
        return 1

    print("No secrets found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

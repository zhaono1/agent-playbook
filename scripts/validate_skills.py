#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"
IGNORE_DIRS = {"reference"}
MAX_SKILL_LINES = 500
CATALOG_PATH = SKILLS_DIR / "catalog.json"

NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REF_PATTERN = re.compile(r"(scripts|references|assets|hooks)/[^\s`\"']+")


def load_front_matter(text: str):
    match = re.match(r"^---\n([\s\S]*?)\n---\n", text)
    if not match:
        return None
    fm_lines = match.group(1).splitlines()
    front_matter = {}
    for line in fm_lines:
        if not line.strip() or line.strip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        front_matter[key.strip()] = value.strip()
    return front_matter


def main() -> int:
    errors = []
    catalog_entries = {}
    catalog_seen = {}

    if not CATALOG_PATH.exists():
        errors.append(f"Missing catalog: {CATALOG_PATH}")
    else:
        try:
            raw_catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"Invalid catalog JSON: {CATALOG_PATH} ({exc})")
            raw_catalog = {}

        if raw_catalog and not isinstance(raw_catalog, dict):
            errors.append(f"Catalog must be a JSON object: {CATALOG_PATH}")
            raw_catalog = {}

        for category, names in raw_catalog.items():
            if not isinstance(names, list):
                errors.append(f"Catalog category must be a list: {CATALOG_PATH} -> {category}")
                continue
            for name in names:
                if not isinstance(name, str):
                    errors.append(f"Catalog entries must be strings: {CATALOG_PATH} -> {category}")
                    continue
                if name in catalog_entries:
                    errors.append(
                        f"Skill listed multiple times in catalog: {name} ({catalog_entries[name]} and {category})"
                    )
                catalog_entries[name] = category
                catalog_seen[name] = False

    for md_file in SKILLS_DIR.glob("*.md"):
        errors.append(f"Unexpected single-file skill: {md_file}")

    for skill_dir in sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir()):
        if skill_dir.name in IGNORE_DIRS:
            continue

        if skill_dir.name == CATALOG_PATH.stem:
            errors.append(f"Unexpected skill directory named like catalog: {skill_dir}")
            continue

        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            errors.append(f"Missing SKILL.md: {skill_dir}")
            continue

        if catalog_entries:
            if skill_dir.name not in catalog_entries:
                errors.append(f"Skill missing from catalog: {skill_dir.name}")
            else:
                catalog_seen[skill_dir.name] = True

        readme_file = skill_dir / "README.md"
        if not readme_file.exists():
            errors.append(f"Missing README.md: {skill_dir}")

        text = skill_file.read_text(encoding="utf-8", errors="ignore")
        front_matter = load_front_matter(text)
        if front_matter is None:
            errors.append(f"Missing front matter: {skill_file}")
            continue

        name = front_matter.get("name")
        description = front_matter.get("description")
        if not name:
            errors.append(f"Missing name in front matter: {skill_file}")
        if not description:
            errors.append(f"Missing description in front matter: {skill_file}")

        if name and name != skill_dir.name:
            errors.append(f"Name does not match directory: {skill_file}")
        if name and not NAME_PATTERN.match(name):
            errors.append(f"Invalid name format: {skill_file}")

        line_count = len(text.splitlines())
        if line_count > MAX_SKILL_LINES:
            errors.append(f"SKILL.md too long ({line_count} lines): {skill_file}")

        for match in REF_PATTERN.finditer(text):
            rel_path = match.group(0)
            if rel_path.startswith("hooks/") and not Path(rel_path).suffix and not rel_path.endswith("/"):
                continue
            target = skill_dir / rel_path
            if not target.exists():
                errors.append(f"Missing referenced file: {skill_file} -> {rel_path}")

    for skill_name, seen in catalog_seen.items():
        if not seen:
            errors.append(f"Catalog references missing skill: {skill_name}")

    if errors:
        print("Skill validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Skill validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

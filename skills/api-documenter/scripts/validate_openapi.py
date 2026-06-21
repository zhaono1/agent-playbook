#!/usr/bin/env python3
# Template validator for OpenAPI schema.

from pathlib import Path
import argparse
import re

DEFAULT_REQUIRED = [
    "openapi:",
    "info:",
    "servers:",
    "paths:",
    "components:",
    "securitySchemes:",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a generated artifact.")
    parser.add_argument("--input", default="openapi.yaml", help="Input file path")
    parser.add_argument(
        "--require",
        action="append",
        default=[],
        help="Additional required section heading",
    )
    args = parser.parse_args()

    path = Path(args.input)
    if not path.exists():
        print(f"Missing file: {path}")
        return 1

    text = path.read_text(encoding="utf-8", errors="ignore")
    required = DEFAULT_REQUIRED + args.require
    missing = [token for token in required if not re.search(rf"^\s*{re.escape(token)}", text, re.MULTILINE)]
    if missing:
        print("Missing required sections: " + ", ".join(missing))
        return 1

    if not re.search(r"^openapi:\s*3\.\d+\.\d+\s*$", text, re.MULTILINE):
        print("Invalid or missing OpenAPI 3.x version")
        return 1

    if not re.search(r"^\s{2}- url:\s+https?://\S+\s*$", text, re.MULTILINE):
        print("Missing absolute http(s) server URL")
        return 1

    if not re.search(r"^\s{2}/[A-Za-z0-9._~!$&'()*+,;=:@%-]+:", text, re.MULTILINE):
        print("No path entries found under paths")
        return 1

    refs = re.findall(r'\$ref:\s+"?#/components/schemas/([^"\s]+)"?', text)
    schemas = set(re.findall(r"^\s{4}([A-Za-z][A-Za-z0-9_]*):\s*$", text, re.MULTILINE))
    missing_refs = [ref for ref in refs if ref not in schemas]
    if missing_refs:
        print("Missing referenced schemas: " + ", ".join(sorted(set(missing_refs))))
        return 1

    print(f"Validated {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

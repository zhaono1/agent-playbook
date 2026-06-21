#!/usr/bin/env python3
# Template generator for OpenAPI schema.

from pathlib import Path
import argparse
import re
import textwrap
from urllib.parse import urlparse


RESOURCE_RE = re.compile(r"^[a-z][a-z0-9-]*$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$")


def validate_resource_name(name: str) -> str:
    value = name.strip().lower()
    if not RESOURCE_RE.fullmatch(value):
        raise argparse.ArgumentTypeError(
            "--name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens"
        )
    return value


def validate_version(version: str) -> str:
    if not VERSION_RE.fullmatch(version):
        raise argparse.ArgumentTypeError("--version must be a semantic version such as 1.0.0")
    return version


def validate_base_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError("--base-url must be an absolute http(s) URL")
    return url.rstrip("/")


def write_output(path: Path, content: str, force: bool) -> bool:
    if path.exists() and not force:
        print(f"{path} already exists (use --force to overwrite)")
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a starter OpenAPI schema.")
    parser.add_argument("--output", default="openapi.yaml", help="Output file path")
    parser.add_argument("--name", default="example", type=validate_resource_name, help="Resource name")
    parser.add_argument("--version", default="1.0.0", type=validate_version, help="API version")
    parser.add_argument(
        "--base-url", default="https://example.com", type=validate_base_url, help="Server base URL"
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing file")
    args = parser.parse_args()

    schema_name = "".join(part.capitalize() for part in args.name.split("-"))

    content = textwrap.dedent(
        f"""\
        openapi: 3.0.3
        info:
          title: {args.name} API
          version: {args.version}
          description: API description for {args.name}
        servers:
          - url: {args.base_url}
        paths:
          /{args.name}:
            get:
              summary: List {args.name}
              responses:
                "200":
                  description: OK
                  content:
                    application/json:
                      schema:
                        type: object
                        properties:
                          items:
                            type: array
                            items:
                              $ref: "#/components/schemas/{schema_name}"
        components:
          schemas:
            {schema_name}:
              type: object
              properties:
                id:
                  type: string
                name:
                  type: string
          securitySchemes:
            bearerAuth:
              type: http
              scheme: bearer
        security:
          - bearerAuth: []
        """
    ).strip() + "\n"

    output = Path(args.output)
    if not write_output(output, content, args.force):
        return 1
    print(f"Wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

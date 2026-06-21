#!/usr/bin/env python3
"""
Validate commit message format against Conventional Commits specification.
"""

import re
import sys


def suggest_imperative(word: str) -> str:
    if word.endswith("ied") and len(word) > 3:
        return word[:-3] + "y"
    if word.endswith("ed") and len(word) > 2:
        base = word[:-2]
        if base.endswith(("at", "it", "op", "er")):
            return base[:-1]
        return base
    if word.endswith("ing") and len(word) > 3:
        return word[:-3]
    return word


def validate_commit_message(message: str) -> tuple[bool, str]:
    """
    Validate a commit message against Conventional Commits format.

    Args:
        message: The commit message to validate

    Returns:
        (is_valid, error_message)
    """
    if not message:
        return False, "Commit message is empty"

    lines = message.split('\n')
    subject = lines[0]

    # Validate subject line format: type(scope)!: subject
    types = "feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert"
    pattern = rf'^({types})(\([A-Za-z0-9_.-]+\))?(!)?: .{{1,72}}$'
    if not re.match(pattern, subject):
        return False, (
            "Invalid format. Expected: type(scope)!: subject\n"
            "- Type must be one of: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert\n"
            "- Subject must be 1-72 characters\n"
            "- Use imperative mood (e.g., 'add feature' not 'added feature')"
        )

    # Check for period at end of subject
    if subject.endswith('.'):
        return False, "Subject line should not end with a period"

    # Check subject uses imperative mood (basic check)
    words = subject.split(': ', 1)[1].split() if ': ' in subject else []
    if words:
        first_word = words[0].lower()
        # Common past tense indicators
        if first_word.endswith(('ed', 'ing')):
            suggestion = suggest_imperative(first_word)
            return False, f"Subject should use imperative mood ('{first_word}' -> '{suggestion}')"

    # Validate body format (if present)
    if len(lines) > 1:
        if lines[1].strip():  # No blank line after subject
            return False, "Separate subject from body with a blank line"

        body = '\n'.join(lines[2:])
        for line in body.split('\n'):
            if len(line) > 72:
                return False, f"Body lines should wrap at 72 characters (found {len(line)})"

    return True, "Valid commit message format"


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_commit.py \"commit message\"")
        sys.exit(1)

    message = sys.argv[1]
    is_valid, result = validate_commit_message(message)

    print(result)
    sys.exit(0 if is_valid else 1)

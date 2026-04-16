# Documentation Engineer

> A Claude Code skill for creating clear, comprehensive documentation.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Write documentation for this API
You: Create a README
You: Document this code
```

## Documentation Types

| Type | Description |
|------|-------------|
| **README** | Project overview and quick start |
| **API Docs** | Endpoint/function documentation |
| **Code Comments** | Inline explanations |
| **Architecture** | System design documentation |

## Scripts

Generate documentation structure:
```bash
python scripts/generate_docs.py
```

Validate documentation:
```bash
python scripts/validate_docs.py
```

## Resources

- [Google Developer Documentation Style Guide](https://developers.google.com/tech-writing/one)
- [Diátaxis Framework](https://diataxis.fr/)

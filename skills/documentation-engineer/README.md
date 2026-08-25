# Documentation Engineer

> A portable agent skill for creating clear, comprehensive documentation.

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
python3 scripts/generate_docs.py --name <service-name> --output docs/README.md
```

Validate documentation:
```bash
python3 scripts/validate_docs.py --input docs/README.md
```

## Resources

- [Google Developer Documentation Style Guide](https://developers.google.com/tech-writing/one)
- [Diátaxis Framework](https://diataxis.fr/)

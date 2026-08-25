# API Designer

> A portable agent skill for REST and GraphQL API design.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Design an API for user management
You: Create API specification
You: Review this API design
```

## API Design Principles

1. **Resource-Oriented**: Nouns, not verbs
2. **Consistent Naming**: kebab-case for URLs
3. **Proper HTTP Methods**: GET, POST, PUT, DELETE
4. **Status Codes**: Correct HTTP status codes
5. **Versioning**: Plan for API evolution

## Scripts

Generate API scaffold:
```bash
python3 scripts/generate_api.py --name <resource-name> --output api-design.md
```

## Resources

- [REST API Tutorial](https://restfulapi.net/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [API Design Guidelines](https://github.com/microsoft/api-guidelines)

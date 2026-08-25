# API Documenter

> A portable agent skill for OpenAPI/Swagger API documentation.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Document this API
You: Create OpenAPI spec
You: Generate API documentation
```

## OpenAPI Specification

The skill generates OpenAPI 3.0 specifications following:
- RESTful conventions
- Clear resource naming
- Complete request/response documentation
- Authentication requirements
- Error response formats

## Scripts

Generate OpenAPI spec:
```bash
python3 scripts/generate_openapi.py --name <resource-name> --output openapi.yaml
```

Validate OpenAPI spec:
```bash
python3 scripts/validate_openapi.py --input openapi.yaml
```

## Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Tools](https://swagger.io/tools/)

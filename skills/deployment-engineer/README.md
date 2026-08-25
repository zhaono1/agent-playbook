# Deployment Engineer

> A portable agent skill for CI/CD pipelines and deployment automation.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Set up CI/CD
You: Create deployment pipeline
You: Configure GitHub Actions
```

## Deployment Strategies

| Strategy | Description |
|----------|-------------|
| **Blue-Green** | Zero downtime, instant rollback |
| **Rolling** | Gradual replacement |
| **Canary** | Test with small traffic first |

## Scripts

Generate deployment config:
```bash
python3 scripts/generate_deploy.py --env <environment> --name <service-name> --output deploy-plan.md
```

Validate deployment:
```bash
python3 scripts/validate_deploy.py --input deploy-plan.md
```

## Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [CI/CD Best Practices](https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment)

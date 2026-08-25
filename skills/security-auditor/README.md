# Security Auditor

> A portable agent skill for security audits and vulnerability assessment.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Audit this code for security issues
You: Check for vulnerabilities
You: Is this code secure?
```

## OWASP Top 10 Coverage

| Category | Checks |
|----------|--------|
| **A01** | Access Control |
| **A02** | Security Misconfiguration |
| **A03** | Software Supply Chain Failures |
| **A04** | Cryptographic Failures |
| **A05** | Injection |
| **A06** | Insecure Design |
| **A07** | Authentication Failures |
| **A08** | Software or Data Integrity Failures |
| **A09** | Security Logging and Alerting Failures |
| **A10** | Mishandling of Exceptional Conditions |

## Scripts

Run security audit:
```bash
python3 scripts/security_audit.py --name <service-name> --output security-audit.md
```

Find secrets:
```bash
python3 scripts/find_secrets.py .
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

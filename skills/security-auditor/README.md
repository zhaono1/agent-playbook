# Security Auditor

> A Claude Code skill for security audits and vulnerability assessment.

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
| **A02** | Cryptographic Failures |
| **A03** | Injection |
| **A04** | Insecure Design |
| **A05** | Security Misconfiguration |
| **A06** | Vulnerable Components |
| **A07** | Authentication Failures |
| **A08** | Data Integrity |
| **A09** | Logging Failures |
| **A10** | SSRF |

## Scripts

Run security audit:
```bash
python scripts/security_audit.py
```

Find secrets:
```bash
python scripts/find_secrets.py
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

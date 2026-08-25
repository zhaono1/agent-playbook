---
name: security-auditor
description: Security vulnerability expert covering OWASP Top 10 and common security issues. Use when conducting security audits or reviewing code for vulnerabilities.
allowed-tools: Read, Grep, Glob, Bash, WebSearch
metadata:
  hooks:
    after_complete:
      - trigger: self-improving-agent
        mode: background
        reason: "Learn from security patterns"
      - trigger: session-logger
        mode: auto
        reason: "Log security audit"
---

# Security Auditor

Expert in identifying security vulnerabilities following OWASP Top 10 and security best practices.

## When This Skill Activates

Activates when you:
- Request a security audit
- Mention "security" or "vulnerability"
- Need security review
- Ask about OWASP

## OWASP Top 10:2025 Coverage

Use the current OWASP Top 10 as an awareness taxonomy, not as proof of complete
security coverage. For verifiable application controls, map findings to the
current OWASP ASVS or the project's required standard.

### A01: Broken Access Control

- Verify authentication and object/function-level authorization on every sensitive path.
- Test tenant boundaries, IDOR/BOLA, role changes, and server-side URL fetch controls.
- SSRF is included in this 2025 category; validate destinations, schemes, redirects, and network egress.

### A02: Security Misconfiguration

- Inspect debug flags, CORS, security headers, default accounts, cloud/IaC policy, and error exposure.
- Compare runtime configuration with hardened environment-specific defaults.

### A03: Software Supply Chain Failures

- Review lockfiles, provenance, build workflows, mutable CI dependencies, update policy, and dependency risk.
- Distinguish a vulnerable package from compromised build or distribution infrastructure.

### A04: Cryptographic Failures

- Check secret storage, transport encryption, key lifecycle, random generation, algorithms, and data-at-rest requirements.
- Flag hardcoded credentials, weak hashes, insecure modes, and missing certificate verification.

### A05: Injection

- Trace untrusted data into SQL/NoSQL, shell, template, LDAP, expression, and browser execution sinks.
- Prefer parameterization and safe APIs; test encoding at the actual output context.

### A06: Insecure Design

- Threat-model trust boundaries, abuse cases, rate limits, high-risk workflows, and failure recovery.
- Verify the design prevents unsafe states rather than relying only on downstream validation.

### A07: Authentication Failures

- Review credential handling, MFA where risk warrants it, reset/recovery flows, session rotation, expiry, and brute-force defenses.

### A08: Software or Data Integrity Failures

- Verify signatures, trusted update channels, deserialization boundaries, artifact integrity, and protection from unauthorized data changes.

### A09: Security Logging and Alerting Failures

- Check that security-relevant events are logged without secrets, protected from tampering, monitored, and connected to actionable alerts.

### A10: Mishandling of Exceptional Conditions

- Exercise malformed input, resource exhaustion, timeouts, partial failures, concurrency, and dependency outages.
- Look for fail-open behavior, swallowed errors, unsafe retries, inconsistent state, and missing rollback or reconciliation.

## Security Audit Checklist

### Code Review
- [ ] No hardcoded secrets
- [ ] Input validation on all inputs
- [ ] Output encoding for XSS prevention
- [ ] Parameterized queries for SQL
- [ ] Proper error handling
- [ ] Authentication on protected routes
- [ ] Authorization checks
- [ ] Rate limiting on public APIs

### Configuration
- [ ] Debug mode off
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Security headers set
- [ ] Environment variables for secrets
- [ ] Database not exposed

### Dependencies
- [ ] No known vulnerabilities
- [ ] Dependencies up to date
- [ ] Unused dependencies removed

## Scripts

Run security audit:
```bash
python3 scripts/security_audit.py --name <service-name> --output security-audit.md
```

Check for secrets:
```bash
python3 scripts/find_secrets.py .
```

## References

- `references/owasp.md` - OWASP Top 10 details
- `references/checklist.md` - Security audit checklist
- `references/remediation.md` - Vulnerability remediation guide

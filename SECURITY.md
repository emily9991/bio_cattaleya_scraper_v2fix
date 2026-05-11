# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅ |
| < Latest | ❌ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, report it privately via:

- **GitHub**: Use the [Report a vulnerability](../../security/advisories/new) button in the Security tab.
- **Email**: _(ylimeimagina21@gmail.com)_

### What to include

- Description of the vulnerability
- Steps to reproduce it
- Affected browser(s) and version(s)
- Extension version
- Potential impact

### What to expect

- **Acknowledgement**: within 48 hours
- **Status update**: within 7 days
- **Fix or mitigation**: within 30 days for critical issues

We follow [responsible disclosure](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerability_Disclosure_Cheat_Sheet.html): we ask that you give us time to patch before any public disclosure.

## Scope

Issues we consider in-scope:

- Cross-site scripting (XSS) via extension content scripts
- Unauthorized data access or exfiltration
- Privilege escalation through browser permissions
- Injection attacks via manifest or background scripts

Out of scope:

- Vulnerabilities in browsers themselves (report to the browser vendor)
- Issues requiring physical access to the device
- Social engineering attacks

## Security Best Practices for Contributors

- Do not request unnecessary [manifest permissions](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- Avoid `eval()` and dynamic code execution (`innerHTML`, `document.write`)
- Sanitize all user-supplied input before DOM insertion
- Use `Content-Security-Policy` headers in the manifest
- Never hardcode API keys, tokens, or secrets

## Disclosure Policy

Once a fix is released, we will publish a summary of the vulnerability in the [Security Advisories](../../security/advisories) section, crediting the reporter (unless they prefer to remain anonymous).

# Security Policy

## Supported Versions

The following versions of `pk-pay` are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of this project seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Please do not report security vulnerabilities via public GitHub issues.**

Instead, please send an email to **[junaidshahzad3@gmail.com](mailto:junaidshahzad3@gmail.com)** with the following information:

- A descriptive title for the vulnerability.
- The severity of the issue (Low, Medium, High, Critical).
- A detailed description of the vulnerability.
- Steps to reproduce the issue (proof-of-concept code is highly appreciated).
- Any potential impact or suggested mitigations.

### Our Commitment

If you report a vulnerability, we will:

- Acknowledge receipt of your report within 48 hours.
- Provide an estimated timeline for a fix.
- Notify you once the vulnerability has been resolved.
- Credit you for the discovery (if desired) in our changelog/release notes.

## Security Features in pk-pay

To protect your payment flows, `pk-pay` includes several built-in security features:

1.  **Timing-Safe Comparisons**: All webhook signature verifications use timing-safe comparison logic to prevent brute-force timing attacks.
2.  **Data Sanitization**: Provider-specific secrets (like `pp_Password` or `integritySalt`) are automatically masked in the `raw` property of results to prevent accidental leakage in logs.
3.  **POST-based Redirects**: JazzCash and EasyPaisa redirects use auto-submit HTML forms to ensure sensitive data (like customer phone numbers) is sent via POST, keeping it out of browser history and server access logs.
4.  **Zod Validation**: All inputs and provider responses are strictly validated at runtime to prevent malformed data injection.

---
*For data processing details, please refer to [PRIVACY.md](PRIVACY.md).*
*Last Updated: March 29, 2026*

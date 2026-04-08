# Audit & Inspection Report: pk-pay SDK

**Date:** March 29, 2026
**Auditor:** Legal & Technical Inspector (Antigravity)
**Project:** pk-pay (Unified TypeScript SDK for Pakistani Payments)

## ⚖️ Executive Summary
The `pk-pay` SDK is a well-engineered, security-conscious library. It demonstrates a high level of adherence to best practices for payment integrations, specifically targeting the unique requirements of the Pakistani financial ecosystem (JazzCash, EasyPaisa).

---

## 🔒 Security Audit
### Findings
1.  **Webhook Signatures**: Implementations for JazzCash and EasyPaisa correctly use HMAC-SHA256 and timing-safe comparisons (`safeCompare`).
2.  **Sensitive Data Leakage**: The `sanitizeRaw` utility effectively masks provider secrets (passwords, salts) in the `raw` output property, preventing accidental logging of credentials.
3.  **POST Redirects**: Critical security feature confirmed. The SDK uses auto-submit forms (`PKPayForm`) to send sensitive transaction data via POST instead of GET, keeping PII out of browser history and server access logs.
4.  **Dependency Security**: Dependencies are minimal (`zod`, `stripe`). Peer dependencies are handled correctly.

### Recommendations
-   **[Low] Timing-Safe Comparison**: The current `safeCompare` in [../src/utils/crypto.ts](../src/utils/crypto.ts) includes an early return on length mismatch. While standard for fixed-length hashes, a "constant-time" approach for length comparisons is preferred in extreme security contexts.
-   **[Medium] Credit Card Handling**: Confirm that no credit card data (PCI-DSS) is handled directly. Currently, Stripe is handled via official SDK/Redirects, and PK providers use account-based flows (MWALLET), which minimizes scope.

---

## 🎯 Accuracy & Robustness Audit
### Findings
1.  **Currency & Amounts**: The SDK uses an "integer-only" (Paisas) approach for internal amounts, which is the industry standard for preventing floating-point errors.
2.  **Timezone Compliance**: Both JazzCash and EasyPaisa require PKT (UTC+5). The date utility correctly offsets UTC time to PKT for these providers.
3.  **Schema Validation**: Use of `Zod` ensures that malformed configuration or user input is caught at the boundary of the SDK, protecting internal logic from unexpected states.

### Recommendations
-   **[Low] JazzCash Amount Rounding**: The current logic uses `Math.round(request.amount / 100)`. If a user passes an amount like `1050` (10.5 PKR), it will be rounded. The SDK should ideally throw a validation error if the amount is not a whole Rupee for JazzCash, or document this behavior clearly.

---

## 📜 Documentation & Legal Audit
### Findings
1.  **License**: MIT License is present and correctly attributed.
2.  **README**: Excellent coverage of features, architecture, and quickstart.
3.  **Developer Experience**: Middleware helpers for Express, Fastify, and Next.js significantly lower the barrier to entry.

### Recommendations
-   **[Action Required] Privacy Note**: Add a `PRIVACY.md` or a section in `README.md` identifying that the SDK transmits PII (Phone/Email) to third-party providers.
-   **[Action Required] Security Reporting**: The `SECURITY.md` is good, but ensuring the email address is correct and responsive is critical for "Legal Inspector" approval.

---

## ✅ Audit Status: **APPROVED (With Minor Remediations)**
The project is fit for production use once the minor recommendations above are addressed.

---

## Update: March 30, 2026

The following remediations have now been implemented:

1. Redirect-form values for JazzCash and EasyPaisa are HTML-escaped before rendering.
2. Stripe PKR requests are rejected instead of being silently reinterpreted as USD.
3. Stripe middleware now requires the exact raw request body for signature verification.
4. Documentation now distinguishes Stripe provider-enforced idempotency from merchant-side reference reuse in JazzCash/EasyPaisa.

---
*End of Report*

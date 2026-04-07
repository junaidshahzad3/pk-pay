# Privacy Policy for pk-pay SDK

Last updated: March 29, 2026

## Introduction
The `pk-pay` SDK is a TypeScript library designed to facilitate payments via JazzCash, EasyPaisa, and Stripe. This document outlines how the SDK handles data and the responsibilities of the developers using it.

## Data Processing
`pk-pay` acts as a **data transmitter**. It does not store, log, or persist any customer data or transaction details on its own.

### Personally Identifiable Information (PII)
The SDK processes the following PII when requested by the developer to initiate a payment:
- **Phone Number**: Required for JazzCash and EasyPaisa mobile account payments.
- **Email Address**: Optional for EasyPaisa and Stripe.
- **Order Details**: Transaction amounts, descriptions, and order IDs.

### Data Flow
1. **Client to SDK**: The developer provides customer data to the SDK's `createPayment` method.
2. **SDK to Provider**: The SDK packages this data into the format required by the payment provider (JazzCash, EasyPaisa, or Stripe) and facilitates a secure transmission (using POST redirects or API calls).
3. **Provider to SDK (Webhooks)**: The SDK receives and verifies transaction status updates from the providers.

## Security Measures
- **No Persistence**: The SDK does not include any database or storage mechanism.
- **Safe Comparison**: All cryptographic signatures are verified using timing-safe logic.
- **Data Sanitization**: Provider secrets and sensitive response fields are masked in the `raw` property of results.
- **POST-based Redirects**: Sensitive data is sent to JazzCash and EasyPaisa via POST forms to prevent leakage in browser history.

## Developer Responsibilities
Developers implementing `pk-pay` are responsible for:
- Ensuring they have a legal basis for processing their customers' PII.
- Disclosing to their users that their data will be shared with the relevant payment provider (JazzCash, EasyPaisa, or Stripe).
- Securing their own server environment and environment variables (API keys, secrets).

## Disclaimer
The `pk-pay` SDK is provided "as is" without warranty of any kind. Developers are encouraged to conduct their own security and privacy audits before production use.

---
*For security vulnerabilities, please refer to [SECURITY.md](SECURITY.md).*

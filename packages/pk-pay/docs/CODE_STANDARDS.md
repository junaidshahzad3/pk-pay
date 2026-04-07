# Code Standards & Architecture

`pk-pay` is built with **security, type-safety, and modularity** as its core principles.

---

## 🏗️ Architecture: The Adapter Pattern

Each payment provider is integrated via a standardized **Adapter**. This allows the top-level SDK to interact with any provider through a unified interface while hiding the complexity of individual hashing, redirects, and webhook shapes.

### `ProviderAdapter` Interface
Every adapter MUST implement:
- `createPayment(request, idempotencyKey)` → Returns a `PaymentResult`.
- `verifyWebhook(payload, signature?)` → Returns a `WebhookEvent`.

This consistency allows you to swap providers by changing a single string (`provider: 'jazzcash'`).

---

## 🛡️ Security Practices

We take security seriously to protect your merchant credentials and customer data.

### 1. Timing-Safe Comparisons
All HMAC and signature verifications use `safeCompare` (powered by Node's `crypto.timingSafeEqual`).
- **Why**: Prevents **timing attacks** where an attacker could brute-force a signature by measuring how long the comparison takes.

### 2. Automatic Data Sanitization
The `raw` property in `PaymentResult` and `WebhookEvent` is automatically sanitized.
- **Redacted fields**: `pp_Password`, `secretKey`, `privateKey`, `integritySalt`, `hashKey`, and `signature`.
- **Goal**: Prevent accidental leakage of sensitive merchant secrets if the raw object is logged to an insecure dashboard or system.

### 3. Zod-Powered Validation
Every input to the SDK is validated at **runtime** using [Zod](https://github.com/colinhacks/zod).
- **Benefit**: Catching configuration errors or invalid amount units immediately, before any network request is made to the provider.

---

## 🧪 Testing

We aim for >95% code coverage with **Vitest**.
- **Unit Tests**: Test each adapter's hashing, redirection logic, and webhook verification.
- **Integration Tests**: Test the unified `createPayment` and `verifyWebhook` entry points.
- **Middleware Tests**: Ensure `Express`, `Fastify`, and `Next.js` handlers properly parse payloads.

Run tests:
```bash
npm run test
```

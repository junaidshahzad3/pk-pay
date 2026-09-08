# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-08

### Changed — BREAKING (JazzCash amounts)

**JazzCash `pp_Amount` is now sent in paisa, unchanged, instead of being divided by 100.**

Earlier versions converted the amount to whole Rupees before sending it, so a
request for `250000` (Rs 2,500.00) was submitted to JazzCash as `2500` — a charge
of Rs 25.00. JazzCash documents `pp_Amount` in the smallest currency unit: their
own sandbox example passes `875045` for Rs 8,750.45.

If you were compensating for this by multiplying your amounts by 100 before
calling `createPayment`, **remove that workaround before upgrading.**

The webhook path is corrected to match: `pp_Amount` on an incoming callback is no
longer multiplied by 100 on the way back, so a genuine Rs 25 payment is no longer
reported to your application as Rs 2,500.

The `amount % 100 !== 0` guard is gone. Amounts with paisa precision — Rs 99.50 —
are now representable.

> Not yet exercised against live merchant credentials. See "Verification status"
> in the README.

### Fixed
- **Secrets escaped redaction when the gateway varied the casing.** `sanitizeRaw`
  matched keys case-sensitively, so a callback carrying `Signature` or `HASH` was
  returned in the clear inside `raw`.
- **Idempotency keys were never validated.** `validateIdempotencyKey` existed but
  was never called or exported, so an unchecked key flowed into `pp_TxnRefNo`.
  Keys containing `&` are now rejected: gateway signatures join field values on
  that character, so an embedded `&` lets two different field sets hash alike.
- **`registerProvider` did not invalidate the adapter cache**, so re-registering a
  provider kept serving the previous constructor.
- **Top-level `environment` was silently ignored.** Each provider schema defaulted
  `environment` to `'sandbox'`, so the `?? config.environment` fallback was dead
  code — a config declaring `environment: 'production'` still produced sandbox
  URLs. Provider-level `environment` is now optional and inherits properly.

### Changed
- Stripe API version pinned to `2026-08-26.dahlia` (was `2025-03-31.basil`); the
  `stripe` peer dependency range moves to `^22.0.0` (was `^17.0.0`).
- The version reported to Stripe in `appInfo` now tracks `package.json`; it had
  drifted to `0.1.0`.

### Added
- Verification-status section in the README stating which adapters have been
  validated against live credentials (none, and why).
- Test suite grown from 105 to 160, covering the EasyPaisa REST/RSA method (which
  previously had no coverage at all), webhook middleware failure paths, adapter
  registry errors, secret redaction, and signing invariants.

## [0.2.0] - 2026-04-03

### Added
- **Dynamic Plugin Architecture**: Introduced a `ProviderRegistry` and `registerProvider()` API, allowing for the addition of custom payment adapters without modifying the core SDK.
- **Flexible Data Types**: Refactored `Provider`, `Environment`, `Currency`, and `PaymentStatus` from strict enums to dynamic strings for maximum extensibility.
- **Full Stripe Multi-Currency**: Removed hardcoded PKR restrictions from the Stripe adapter, enabling support for 135+ Stripe-supported currencies (USD, SAR, EUR, etc.).
- **EasyPaisa REST (RSA)**: Implemented high-security RSA 2048-bit digital signatures for the latest v2.0 REST API.
- **Dynamic Sanitization**: Exported `DEFAULT_SENSITIVE_KEYS` and updated `sanitizeRaw` to allow passing additional custom keys for redaction.

### Changed
- **Config Schema**: Updated `PkPayConfigSchema` to use `.catchall()`, permitting storage of arbitrary configuration for custom providers.
- **Middleware Routing**: Refactored all webhook middleware to use the dynamic registry for adapter lookup.
- **Stripe API**: Version pinned to `2025-03-31.basil`.

## [0.1.2] - 2026-04-03

### Fixed

- Migrated to ESLint 9 with a dedicated flat configuration (`eslint.config.js`).
- Resolved TypeScript project root ambiguity by setting `rootDir: "."` and adding `paths` mapping for self-imports.
- Fixed minor lint errors and type mismatches in JazzCash and Stripe provider tests.
- Added `@ts-nocheck` to documentation examples to prevent environment-specific type errors during SDK builds.


## [0.1.1] - 2026-03-30

### Changed

- Escaped JazzCash and EasyPaisa redirect-form attribute values before rendering hosted POST forms.
- Rejected Stripe `PKR` payment requests with a `ValidationError` instead of silently reinterpreting the amount as USD.
- Made Stripe Express and Next.js Pages webhook helpers fail closed unless the raw request body is available.
- Clarified provider constraints and idempotency guarantees across README, security notes, and inline docs.
- Cleaned package export ordering to remove Node/tsup `types` condition warnings during build.

### Fixed

- Closed an HTML injection path in hosted redirect forms.
- Removed unused EasyPaisa legacy MD5 helper code that was surfacing as a bundling warning.

## [0.1.0] - 2026-03-16

### Added

**Core SDK**
- `configure(config)` — global SDK initializer with Zod validation
- `createPayment(request)` — unified payment creation across all providers
- `verifyWebhook(provider, payload, signature?)` — unified webhook verification
- `createClient(config)` — `PkPayClient` class for multi-tenant / non-singleton use cases

**Providers**
- **JazzCash** adapter with HMAC-SHA256 secure hash (JazzCash API v1.1), MWALLET redirect checkout, sandbox/production URL switching, IPN webhook signature verification, and full response code mapping (000, 001, 109, 121, 157, etc.)
- **EasyPaisa** adapter with HMAC-SHA256 Base64 hash, MA Pay redirect checkout, phone normalization (+92 → 0xxx), PKR paisas ↔ rupees conversion, IPN webhook verification
- **Stripe** adapter wrapping the official Stripe SDK, Checkout Sessions API, `webhooks.constructEvent()` verification, lazy package loading (optional peer dep)

**Utilities**
- `withRetry(fn, options)` — exponential backoff with jitter, configurable `isRetryable` predicate, defaults to network errors + 5xx HTTP codes
- `generateIdempotencyKey()` — UUID v4 via Web Crypto API
- `resolveIdempotencyKey(provided?)` — uses provided or generates new
- `getIdempotencyHeader(provider)` — per-provider header name
- `validateIdempotencyKey(key)` — printable ASCII, 1–255 chars

**Middleware**
- `createWebhookMiddleware(provider, options)` — Express.js RequestHandler factory
- `pkPayWebhookPlugin(options)` — Fastify plugin factory
- `createNextWebhookHandler(provider, options)` — Next.js App Router POST handler
- `createNextPagesWebhookHandler(provider, options)` — Next.js Pages Router handler

**Error Types**
- `PkPayError` — base error class with `code`, `provider`, `raw`
- `ProviderError` — provider API errors with `httpStatus`
- `ValidationError` — Zod validation failures
- `ConfigurationError` — missing or invalid SDK/provider configuration

**Infrastructure**
- `tsup` build: dual ESM + CJS output with TypeScript declarations
- `vitest` test suite with V8 coverage (≥80% threshold)
- GitHub Actions CI: lint + typecheck + test on Node.js 18, 20, 22
- GitHub Actions publish workflow: auto-publish to npm on GitHub Release with provenance

[0.3.0]: https://github.com/junaidshahzad3/pk-pay/releases/tag/v0.3.0
[0.2.0]: https://github.com/junaidshahzad3/pk-pay/releases/tag/v0.2.0
[0.1.2]: https://github.com/junaidshahzad3/pk-pay/releases/tag/v0.1.2
[0.1.1]: https://github.com/junaidshahzad3/pk-pay/releases/tag/v0.1.1
[0.1.0]: https://github.com/junaidshahzad3/pk-pay/releases/tag/v0.1.0

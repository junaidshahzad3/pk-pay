# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/junaidshahzad3/pk-pay/releases/tag/v0.1.0

# 🇵🇰 pk-pay — Project Plan
> Unified TypeScript SDK for Pakistani Payments (JazzCash + EasyPaisa + Stripe)

**From:** GitHub Principal Engineer Roadmap (Phase 2 — Project 1)
**Context:** This is the first project to ship in the GitHub portfolio plan. Target: published to npm, pinned on profile, used as the foundation for a potential signature project (Phase 5).

---

## 🎯 Goal

Build and publish a **production-quality, TypeScript-native, unified payment SDK** that abstracts JazzCash, EasyPaisa, and Stripe behind a single clean API. Fill the real gap: the only existing options are unmaintained PHP/Laravel packages and a single outdated Node.js package (`jazzcash-checkout`, 2023, no TypeScript, no EasyPaisa).

**Published package name:** `pk-pay` on npm
**Target timeline:** Month 1 (Weeks 2–4) per the roadmap

---

## 📊 Current State

| Area | Status |
|------|--------|
| `package.json` | ✅ Setup complete |
| `README.md` | ✅ Content complete |
| `src/index.ts` | ✅ Implementation complete |
| `src/providers/jazzcash/` | ✅ Implementation complete |
| `src/providers/easypaisa/` | ✅ Implementation complete |
| `src/providers/stripe/` | ✅ Implementation complete |
| `src/utils/idempotency.ts` | ✅ Implementation complete |
| `src/utils/retry.ts` | ✅ Implementation complete |
| `src/middleware/express/` | ✅ Implementation complete |
| `src/middleware/fastify/` | ✅ Implementation complete |
| `src/middleware/nextjs/` | ✅ Implementation complete |
| `src/types/` | ✅ Implementation complete |
| `tests/providers/*.test.ts` | ✅ Comprehensive tests (94-100% coverage) |
| `CHANGELOG.md` | ✅ Exists |
| `CONTRIBUTING.md` | ✅ Exists |
| `LICENSE` | ✅ Exists |
| `.gitignore` | ✅ Exists |
| `.env.example` | ✅ Exists |
| `.github/workflows/` | ✅ Exists (CI/CD configured) |

---

## 🏗️ Architecture

```
pk-pay/
├── src/
│   ├── index.ts                  # Public API entry point (createPayment, createWebhookHandler)
│   ├── types/
│   │   └── index.ts              # All shared types: PaymentRequest, PaymentResult, Provider, etc.
│   ├── providers/
│   │   ├── jazzcash/
│   │   │   └── index.ts          # JazzCash adapter (MWALLET + REST API)
│   │   ├── easypaisa/
│   │   │   └── index.ts          # EasyPaisa adapter (OTC + MA)
│   │   └── stripe/
│   │       └── index.ts          # Stripe adapter (Stripe SDK wrapper)
│   ├── utils/
│   │   ├── retry.ts              # Exponential backoff retry logic
│   │   └── idempotency.ts        # Idempotency key generation + enforcement
│   └── middleware/
│       ├── express/              # Express.js webhook middleware
│       ├── fastify/              # Fastify webhook middleware
│       └── nextjs/               # Next.js route handler helpers
├── tests/
│   ├── providers/
│   │   ├── jazzcash.test.ts
│   │   ├── easypaisa.test.ts
│   │   └── stripe.test.ts
│   └── utils/
│       └── (retry & idempotency tests)
├── docs/
│   └── examples/                 # Usage examples per framework
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint + test on PR
│       └── publish.yml           # npm publish on release tag
└── PLAN.md                       # This file
```

---

### ✅ Implementation Checklist

### 📦 Phase A — Project Setup
- [x] Fill `package.json` — name, version, scripts, exports, types, peerDependencies
- [x] Set up `tsconfig.json` — strict mode, `declaration: true`, `outDir: dist`
- [x] Set up `vitest.config.ts` — coverage thresholds (≥80%)
- [x] Fill `.env.example` with all provider credential keys
- [x] Verify `.github/workflows/ci.yml` runs `lint + test` on PR
- [x] Set up `semantic-release` or manual versioning in `publish.yml`

### 🔷 Phase B — Types
- [x] Define `Provider` union type: `'jazzcash' | 'easypaisa' | 'stripe'`
- [x] Define `PaymentRequest` — unified input shape
- [x] Define `PaymentResult` — unified response (with `provider`, `transactionId`, `status`, `raw`)
- [x] Define `WebhookEvent` type for each provider
- [x] Define provider-specific config types (`JazzCashConfig`, `EasyPaisaConfig`, `StripeConfig`)
- [x] Define `PkPayConfig` — top-level SDK config including `environment: 'sandbox' | 'production'`

### 🟢 Phase C — Core API
- [x] Implement `createPayment(request: PaymentRequest): Promise<PaymentResult>` in `src/index.ts`
- [x] Implement `configure(config: PkPayConfig)` — initializer / factory pattern
- [x] Route to correct provider adapter based on `request.provider`
- [x] Integrate retry logic from `utils/retry.ts` around provider calls
- [x] Integrate idempotency key logic from `utils/idempotency.ts`

### 🔌 Phase D — Provider Adapters
- [x] JazzCash adapter working + tested
- [x] EasyPaisa adapter working + tested
- [x] Stripe adapter working + tested

### 🔗 Phase E — Middleware Helpers
- [x] **Express** — `createWebhookMiddleware(provider, config)` → `RequestHandler`
- [x] **Fastify** — `createWebhookPlugin(provider, config)` → Fastify plugin
- [x] **Next.js** — `createWebhookHandler(provider, config)` → `NextApiHandler`

### 🧪 Phase F — Tests
- [x] `tests/providers/` tests complete
- [x] `tests/utils/` tests complete
- [x] Middleware and Core API tests added
- [x] Achieve ≥80% code coverage (Current: **94.7%**)

### 📖 Phase G — Documentation & Publishing
- [ ] Write `README.md` — full structure (see README template below)
- [ ] Write `docs/examples/express.ts` — end-to-end Express webhook example
- [ ] Write `docs/examples/nextjs.ts` — end-to-end Next.js App Router example
- [ ] Update `CHANGELOG.md` for v0.1.0
- [ ] Build: `npm run build` → `dist/` output with `.d.ts` files
- [ ] Dry-run publish: `npm publish --dry-run`
- [ ] Publish to npm: `npm publish`
- [ ] Create GitHub Release v0.1.0
- [ ] Add npm version badge + build status badge to README
- [ ] Pin repo on GitHub profile

---

## 📋 README Template

```markdown
# pk-pay
> Unified TypeScript SDK for Pakistani payments — JazzCash, EasyPaisa, and Stripe in one API

[![npm](https://img.shields.io/npm/v/pk-pay)](https://www.npmjs.com/package/pk-pay)
[![Build](https://github.com/junaidshahzad3/pk-pay/actions/workflows/ci.yml/badge.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Problem
Pakistani developers building SaaS products have no good TypeScript payment option. Existing packages are unmaintained PHP wrappers or outdated Node.js libraries with no types and no unified interface.

## Solution
One install. One API. Swap providers by changing a single string.

\`\`\`typescript
import { createPayment } from 'pk-pay';

const payment = await createPayment({
  provider: 'jazzcash', // | 'easypaisa' | 'stripe'
  amount: 1000,
  currency: 'PKR',
  description: 'SaaS subscription',
  returnUrl: 'https://yourapp.com/payment/callback',
});
\`\`\`

## Features
- ✅ Unified API — swap provider in one line
- ✅ Full TypeScript with strict types + autocompletion
- ✅ Webhook handling helpers (Express, Fastify, Next.js)
- ✅ Sandbox / production environment switching
- ✅ Retry logic + idempotency keys built in
- ✅ Comprehensive test suite with mocked provider responses

## Quick Start
\`\`\`bash
npm install pk-pay
\`\`\`

## Architecture
[Brief explanation of adapter pattern + diagram]

## Tech Decisions
- **Zod** over manual validation — runtime safety for untrusted provider responses
- **Vitest** over Jest — faster, native ESM, same API surface
- **Adapter pattern** — each provider isolated, unified interface enforced by TypeScript
```

---

## 🔑 Key Design Decisions (ADRs)

Document these in `docs/adr/` as the project matures:

| # | Decision | Direction |
|---|----------|-----------|
| ADR-001 | Adapter pattern vs. per-provider exports | Unified factory (`createPayment`) + optional per-provider clients |
| ADR-002 | Zod vs. manual types for provider responses | Zod — catches breaking API changes from providers at runtime |
| ADR-003 | Vitest vs. Jest | Vitest — native ESM, no Babel transform needed for TypeScript |
| ADR-004 | Retry strategy | Exponential backoff with jitter, max 3 retries, only on network errors |
| ADR-005 | Idempotency key generation | UUID v4 generated client-side, passed as header per provider's requirements |

---

## 🛠️ Dev Commands (target)

```bash
npm run build        # tsc → dist/
npm run test         # vitest run
npm run test:watch   # vitest watch
npm run test:cov     # vitest run --coverage
npm run lint         # eslint src/ tests/
npm run typecheck    # tsc --noEmit
```

---

## 📅 Week-by-Week Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| **Week 2** | Setup + Types + JazzCash | `package.json` filled, types defined, JazzCash adapter working + tested |
| **Week 3** | EasyPaisa + Stripe + Middleware | Both adapters done, all 3 middleware helpers working |
| **Week 4** | Tests + Docs + Publish | ≥80% coverage, README written, published to npm as v0.1.0 |

---

## 🔗 Reference Links

| Resource | Use |
|----------|-----|
| [JazzCash Merchant Portal](https://sandbox.jazzcash.com.pk/) | Sandbox credentials + API docs |
| [EasyPaisa Payment Gateway](https://easypay.easypaisa.com.pk/) | Merchant API docs |
| [Stripe Docs](https://stripe.com/docs/api) | Stripe API reference |
| [jazzcash-checkout (npm)](https://www.npmjs.com/package/jazzcash-checkout) | Existing outdated package — study as reference |
| [Zod](https://zod.dev) | Runtime validation for provider responses |
| [Vitest](https://vitest.dev) | Test framework |
| [semantic-release](https://github.com/semantic-release/semantic-release) | Automated npm publishing |
| [shields.io](https://shields.io) | Badge generator for README |

---

*Created: March 2026*
*Start date: ___________*
*Target publish date: ___________*

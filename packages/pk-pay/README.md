# pk-pay

> Unified TypeScript SDK for Pakistani payments — JazzCash, EasyPaisa, and Stripe in one API.

[![npm](https://img.shields.io/npm/v/pk-pay?color=CB3837&logo=npm)](https://www.npmjs.com/package/pk-pay)
[![Build](https://github.com/junaidshahzad3/pk-pay/actions/workflows/ci.yml/badge.svg)](https://github.com/junaidshahzad3/pk-pay/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.0.0-43853d?logo=node.js)](https://nodejs.org/)

One install. One API shape. Built for flexibility, security, and developer productivity.

---

## 📑 Table of Contents
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Dynamic Plugin Architecture](#-dynamic-plugin-architecture)
- [Environment Support](#-environment-support)
- [Middleware Helpers](#-middleware-helpers)
- [Documentation Index](#-documentation-index)
- [Security Features](#-security-features)
- [Contributing](#-contributing)
- [License](#-license)

---

## ⚡ Features
- ✅ **Unified API** — Create payments and verify webhooks for multiple providers with one shape.
- ✅ **Plugin-Based** — Register any custom provider via the registry.
- ✅ **Stripe Multi-Currency** — Full support for 135+ currencies (USD, SAR, EUR, etc.).
- ✅ **Framework Friendly** — Pre-built middleware for Express, Fastify, and Next.js.
- ✅ **Type Safe** — First-class TypeScript support with deep Zod validation.

---

## 🚀 Quick Start

> **Wanna see it live?** Check out the [Interactive Playground](../../apps/playground) to test the SDK with your own API keys.

## 🛠️ Installation
```bash
npm install pk-pay
# For Stripe support (optional):
npm install stripe
```

## 🚀 Quick Start

### 1. Configure
```typescript
import { configure } from 'pk-pay';

configure({
  environment: 'sandbox', // 'production', 'staging', or any custom string
  maxRetries: 3,
  jazzcash: {
    merchantId: '...',
    password: '...',
    integritySalt: '...',
  },
  easypaisa: {
    method: 'rest', // or 'legacy'
    storeId: '...',
    username: '...',
    password: '...',
    privateKey: '...',
  },
  stripe: {
    secretKey: '...',
    webhookSecret: '...', // optional
  },
});
```

### 2. Create Payment
```typescript
import { createPayment } from 'pk-pay';

const payment = await createPayment({
  provider: 'stripe',
  amount: 2500,         // $25.00 in cents
  currency: 'USD',      // Stripe supports 135+ currencies
  description: 'International SaaS Pro Plan',
  returnUrl: 'https://yourapp.com/payment/callback',
});

// Securely redirect:
if (payment.redirectForm) {
  res.send(payment.redirectForm); // For JazzCash/EasyPaisa POST forms
} else {
  res.redirect(payment.redirectUrl!); // For Stripe/Custom GET redirects
}
```

---

## 🛠️ Middleware Helpers

`pk-pay` provides ready-to-use handlers for popular frameworks to handle webhooks effortlessly.

### Express
```typescript
import { createWebhookMiddleware } from 'pk-pay';
app.post('/webhook/jazzcash', createWebhookMiddleware('jazzcash'));
```

### Fastify
```typescript
import { pkPayWebhookPlugin } from 'pk-pay';
fastify.register(pkPayWebhookPlugin, { provider: 'easypaisa' });
```

### Next.js (App Router)
```typescript
import { createNextWebhookHandler } from 'pk-pay/middleware/nextjs';
export const POST = createNextWebhookHandler('stripe');
```

---

## 📖 Documentation Index

For detailed guides, architecture, and security practices, see the nested documentation:

### 📱 [Provider Setup Guide](docs/PROVIDERS.md)
Detailed configuration for **JazzCash (v2.0)**, **EasyPaisa (Legacy/REST RSA)**, and **Stripe (Basil)**.

### 🏗️ [Architecture & Code Standards](docs/CODE_STANDARDS.md)
Deep dive into the **Adapter Pattern**, **Timing-Safe Sanitization**, and **Security Hardening**.

### 🛠️ [Middleware Helpers](README.md#express)
Quick integration for **Express**, **Fastify**, and **Next.js**.

---

## 🧩 Plugins & Custom Providers

`pk-pay` is built on a dynamic registry. You can add support for any payment gateway without modifying the core library:

```typescript
import { registerProvider, configure, createPayment } from 'pk-pay';

// 1. Implement your own provider adapter
class MyBankAdapter {
  constructor(private config: any) {}
  async createPayment(req) { /* logic */ }
  async verifyWebhook(payload, sig) { /* logic */ }
}

// 2. Register it
registerProvider('my_bank', MyBankAdapter);

// 3. Configure it
configure({
  my_bank: { apiKey: 'secret-key' }
});

// 4. Use it!
await createPayment({ provider: 'my_bank', ... });
```

## 🛡️ Security Features

- ✅ **Timing-Safe** — All HMAC/RSA verifications are timing-attack resistant.
- ✅ **Auto-Sanitized** — Raw provider responses automatically redact sensitive keys.
- ✅ **Dynamic Redaction** — Extend redaction via `DEFAULT_SENSITIVE_KEYS`.
- ✅ **Version Pinned** — Defaulting to the latest 2024/2025 API standards.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE) © Junaid Shahzad

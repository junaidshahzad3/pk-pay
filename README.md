# pk-pay

> Unified TypeScript SDK for Pakistani payments — JazzCash, EasyPaisa, and Stripe in one API

[![npm](https://img.shields.io/npm/v/pk-pay?color=CB3837&logo=npm)](https://www.npmjs.com/package/pk-pay)
[![Build](https://github.com/junaidshahzad3/pk-pay/actions/workflows/ci.yml/badge.svg)](https://github.com/junaidshahzad3/pk-pay/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

One install. One API shape. Integrates each provider from scratch, duplicating authentication, hashing, retry logic, and webhook verification.

---

## 🚀 Quick Start

> **Wanna see it live?** Check out the [full checkout demo](examples/full-checkout-demo) for a complete implementation.

### 1. Installation
```bash
npm install pk-pay
# For Stripe support (optional):
npm install stripe
```

### 2. Configure
```typescript
import { configure } from 'pk-pay';

configure({
  environment: 'sandbox', // 'production' for live
  jazzcash: {
    merchantId: '...',
    password: '...',
    integritySalt: '...',
  },
  easypaisa: {
    method: 'rest', // or 'legacy'
    storeId: '...',
    privateKey: '-----BEGIN PRIVATE KEY...-----',
  }
});
```

### 3. Create Payment
```typescript
import { createPayment } from 'pk-pay';

const payment = await createPayment({
  provider: 'jazzcash',
  amount: 100_000,      // 1,000 PKR (in paisas)
  currency: 'PKR',
  description: 'Pro Subscription',
  returnUrl: 'https://yourapp.com/payment/callback',
  customerPhone: '03001234567',
});

// Securely redirect:
if (payment.redirectForm) {
  res.send(payment.redirectForm);
} else {
  res.redirect(payment.redirectUrl!);
}
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

## 🛡️ Security Features

- ✅ **Timing-Safe** — All HMAC/RSA verifications are timing-attack resistant.
- ✅ **Auto-Sanitized** — Raw provider responses automatically redact sensitive keys.
- ✅ **Version Pinned** — Defaulting to the latest 2024/2025 API standards.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE) © Junaid Shahzad

# Provider Configuration Guide

This guide provides detailed instructions for setting up each payment provider supported by `pk-pay`.

---

## 📱 JazzCash (v2.0)

JazzCash is Pakistan's leading mobile wallet. `pk-pay` uses the **MWALLET** (Mobile Wallet) integration flow by default.

### Configuration
```typescript
{
  merchantId: 'MC12345',
  password: '...',
  integritySalt: '...',
  version: '2.0', // Defaults to 2.0
}
```

### Dashboard Settings
1. Log in to the [JazzCash Sandbox/Production Portal](https://sandbox.jazzcash.com.pk/Business/Login).
2. Ensure your **Merchant ID** and **Hash Key (Integrity Salt)** are correct.
3. Set your **Return URL** to your application's callback endpoint.

---

## 💸 EasyPaisa

EasyPaisa is the most widely used fintech solution in Pakistan. `pk-pay` supports two integration methods.

### 1. Modern REST API (v2.0) — Recommended
Uses **RSA 2048-bit digital signatures** for maximum security.

**Configuration:**
```typescript
{
  method: 'rest',
  storeId: '12345',
  privateKey: '-----BEGIN PRIVATE KEY...-----',
  easypaisaPublicKey: '-----BEGIN PUBLIC KEY...-----', // Optional but recommended
  username: '...',
  password: '...'
}
```

### 2. Legacy Hosted Checkout (HMAC)
Uses a shared secret (`hashKey`) to sign requests.

**Configuration:**
```typescript
{
  method: 'legacy',
  storeId: '12345',
  hashKey: '...',
  username: '...',
  password: '...'
}
```

> [!TIP]
> To generate an RSA key pair on Windows/Linux:
> ```bash
> openssl genrsa -out private_key.pem 2048
> openssl rsa -in private_key.pem -pubout -out public_key.pem
> ```
> Upload the `public_key.pem` to the EasyPaisa portal in the "Security Settings" section.

---

## 💳 Stripe (v2025-03-31)

Standard global payment processor. `pk-pay` uses **Stripe Checkout Sessions**.

### Configuration
```typescript
{
  secretKey: 'sk_test_...',
  webhookSecret: 'whsec_...',
  environment: 'sandbox'
}
```

### Key Considerations
1. **Currency**: Stripe supports [135+ currencies](https://stripe.com/docs/currencies) (USD, EUR, GBP, etc.). Note: `PKR` is currently not supported for standard checkout sessions by Stripe.
2. **Webhook Verification**: Ensure you pass the **exact raw request body** (as a Buffer or String) to the `verifyWebhook` function to avoid signature mismatches.

---

## Comparison Table

| Feature | JazzCash | EasyPaisa | Stripe |
| :--- | :--- | :--- | :--- |
| **Smallest Unit** | Paisa | Paisa | Cent |
| **PKR Support** | ✅ Yes | ✅ Yes | ❌ No (use USD/EUR) |
| **All ISO-3** | ❌ No | ❌ No | ✅ Yes |
| **Redirection** | POST Form | POST or GET | GET (URL) |
| **Hashing** | HMAC-SHA256 | RSA or HMAC | SHA256 (Stripe SDK) |

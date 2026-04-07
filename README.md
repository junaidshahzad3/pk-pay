# pk-pay Ecosystem

> Unified TypeScript SDK for Pakistani payments — JazzCash, EasyPaisa, and Stripe in one API.

One install. One API shape. Built for flexibility, security, and developer productivity.

---

## 🏗️ Repository Structure

This is a professional monorepo setup consisting of the core library and a premium testing environment.

### 📦 [Core SDK (packages/pk-pay)](packages/pk-pay/README.md)
The production-ready TypeScript SDK that simplifies JazzCash, EasyPaisa, and Stripe integrations.
- **Unified API**: One shape for all providers.
- **Plugin-Based**: Add any gateway via the registry.
- **Framework Helpers**: Ready-to-use middleware for Express, Fastify, and Next.js.

### 🎮 [Interactive Playground (apps/playground)](apps/playground/README.md)
A high-end Next.js 15 testing environment to verify integrations in real-time.
- **Bring Your Own Keys (BYOK)**: Securely test with your own provider credentials.
- **Live Handshakes**: Execute real transaction flows in a sandbox.
- **Real-Time Webhooks**: Live event feed backed by Upstash Redis.

---

## 🚀 Quick Start

To develop locally or contribute to the ecosystem:

```bash
# 1. Clone the repository
git clone https://github.com/junaidshahzad3/pk-pay.git

# 2. Register all dependencies and link workspaces
npm install

# 3. Launch the Playground
npm run dev:playground

# 4. Run SDK Tests
npm test
```

## 📖 Key Documentation

- **[Architecture & Security](packages/pk-pay/docs/CODE_STANDARDS.md)**: Deep dive into the timing-safe adapter pattern.
- **[Provider Setup Guide](packages/pk-pay/docs/PROVIDERS.md)**: Configuration for JazzCash, EasyPaisa, and Stripe.
- **[Contributing](CONTRIBUTING.md)**: How to add new providers or improve the core.

---

## 📄 License

[MIT](LICENSE) © Junaid Shahzad

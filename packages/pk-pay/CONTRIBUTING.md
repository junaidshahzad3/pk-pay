# Contributing to pk-pay

Thank you for your interest in contributing! This library helps Pakistani developers build better payment integrations. Your contributions make a real difference.

## Development Setup

```bash
# Clone & install
git clone https://github.com/junaidshahzad3/pk-pay.git
cd pk-pay
npm install

# Copy env and fill in sandbox credentials
cp .env.example .env
```

## Development Commands

```bash
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test         # Run tests
npm run test:watch   # Tests in watch mode
npm run test:cov     # Tests with coverage report
npm run build        # Build dist/
```

## Project Structure

```
src/
├── index.ts              # Public API (configure, createPayment, verifyWebhook)
├── types/index.ts        # All shared types and Zod schemas
├── utils/
│   ├── retry.ts          # Exponential backoff retry
│   └── idempotency.ts    # Idempotency key generation
├── providers/
│   ├── jazzcash/         # JazzCash adapter
│   ├── easypaisa/        # EasyPaisa adapter
│   └── stripe/           # Stripe adapter
└── middleware/
    ├── express/           # Express.js webhook middleware
    ├── fastify/           # Fastify plugin
    └── nextjs/            # Next.js route handlers
tests/
├── providers/            # Provider adapter tests
└── utils/                # Utility tests
```

## Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add EasyPaisa MA payment support
fix: correct JazzCash hash computation for empty fields
docs: add Express webhook middleware example
test: add retry backoff timing tests
chore: update zod to 3.24
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`

## Adding a New Provider

With our **Dynamic Plugin Architecture**, you can add new providers without modifying the core SDK:

1.  **Implement the Adapter**: Create a class that implements the `ProviderAdapter` interface (see `src/types/index.ts`).
2.  **Define Config**: Add your provider's specific configuration schema (if any).
3.  **Registering**: Use `registerProvider('your-name', YourAdapterClass)` to plug it into the SDK.
4.  **Testing**: Add a new test file in `tests/providers/<name>.test.ts` or add to `tests/dynamic_providers.test.ts`.

If you believe the provider should be part of the official core package, please open a feature request first!

## Pull Request Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Write tests for your changes (aim for ≥80% coverage).
3. Ensure all checks pass: `npm run typecheck && npm run lint && npm run test`.
4. Open a PR using the provided **Pull Request Template**.

## Reporting Issues

Please use our **Issue Templates** to report bugs or request features. This ensures we have all the context (Node version, specific provider, logs) needed to help you quickly.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, constructive, and kind. We're all here to build better software for the community.

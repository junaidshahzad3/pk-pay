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

1. Create `src/providers/<name>/index.ts`
2. Export an adapter class implementing `ProviderAdapter` from `src/types/index.ts`
3. Add provider name to the `Provider` union type in `src/types/index.ts`
4. Add a config schema and type to `src/types/index.ts`
5. Wire it up in `src/index.ts` (`getAdapter` switch)
6. Add tests in `tests/providers/<name>.test.ts`
7. Update `README.md` and `.env.example`

## Pull Request Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Write tests for your changes (aim for ≥80% coverage)
3. Ensure all checks pass: `npm run typecheck && npm run lint && npm run test`
4. Open a PR with the template below

### PR Template

```markdown
## What
Brief description of the change.

## Why
Link to the issue. What problem does this solve?

## How
Your approach and any alternatives considered.

## Testing
How did you test this? Any edge cases?
```

## Reporting Issues

Please include:
- Node.js version (`node --version`)
- pk-pay version
- Provider being used (JazzCash / EasyPaisa / Stripe)
- Minimal reproduction code
- Error message and stack trace

## Code of Conduct

Be respectful, constructive, and kind. We're all here to build better software for the community.

# Contributing to pk-pay

First off, thank you for considering contributing to `pk-pay`! It's people like you who make it such a great tool for the Pakistani developer community.

## 🏗️ Monorepo Structure

This project is organized as a monorepo using npm workspaces:

- `packages/pk-pay`: The core SDK source code.
- `apps/playground`: The interactive testing environment.

## 🚀 Getting Started

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/pk-pay.git
   cd pk-pay
   ```

2. **Install Everything**:
   ```bash
   # This will link all workspaces and install shared dependencies
   npm install
   ```

3. **Development**:
   - To work on the core SDK: Look in `packages/pk-pay/src`.
   - To work on the playground: Look in `apps/playground/src`.

## 🧪 Running Tests

We use Vitest for the core SDK. Run tests from the root:

```bash
# Run all SDK tests
npm test

# Run with coverage
npm run test:cov --workspace=packages/pk-pay
```

## 🛠️ Workspace Commands

We use npm workspaces to manage the ecosystem:

- **Build SDK**: `npm run build --workspace=packages/pk-pay`
- **Run Playground**: `npm run dev:playground`
- **Lint All**: `npm run lint`

## 📬 Pull Request Process

1. Create a new branch for your feature or fix.
2. Ensure all tests pass.
3. Update documentation if you've added new features or providers.
4. Submit a PR against the `develop` branch.

## 🏛️ Code of Conduct

Please note we have a [Code of Conduct](CODE_OF_CONDUCT.md). Please follow it in all your interactions with the project.

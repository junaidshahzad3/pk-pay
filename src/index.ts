/**
 * pk-pay — Unified TypeScript SDK for Pakistani Payments
 *
 * The main entry point. Use `configure()` to initialize the SDK,
 * then `createPayment()` to process payments across JazzCash, EasyPaisa, and Stripe.
 *
 * Provider-specific constraints still apply:
 * - JazzCash requires whole-rupee PKR amounts and a customer phone number
 * - EasyPaisa requires a customer phone number
 * - Stripe requires a Stripe-supported currency (not PKR)
 *
 * @example
 * ```typescript
 * import { configure, createPayment } from 'pk-pay';
 *
 * configure({
 *   environment: 'sandbox',
 *   jazzcash: {
 *     merchantId: process.env.JAZZCASH_MERCHANT_ID!,
 *     password: process.env.JAZZCASH_PASSWORD!,
 *     integritySalt: process.env.JAZZCASH_INTEGRITY_SALT!,
 *   },
 * });
 *
 * const payment = await createPayment({
 *   provider: 'jazzcash',
 *   amount: 100000,      // 1000.00 PKR in paisas
 *   currency: 'PKR',
 *   description: 'SaaS subscription - Pro Plan',
 *   returnUrl: 'https://yourapp.com/payment/callback',
 *   customerPhone: '03001234567',
 * });
 *
 * // Redirect user to payment.redirectUrl
 * ```
 */

import { JazzCashAdapter } from './providers/jazzcash/index.js';
import { EasyPaisaAdapter } from './providers/easypaisa/index.js';
import { StripeAdapter } from './providers/stripe/index.js';
import { withRetry } from './utils/retry.js';
import { resolveIdempotencyKey } from './utils/idempotency.js';
import {
  type PkPayConfig,
  type PkPayConfigResolved,
  type PaymentRequest,
  type PaymentResult,
  type WebhookEvent,
  type ProviderAdapter,
  type Provider,
  PkPayConfigSchema,
  PaymentRequestSchema,
  ConfigurationError,
  ValidationError,
} from './types/index.js';

// Re-export everything consumers need
export type {
  PkPayConfig,
  PaymentRequest,
  PaymentResult,
  WebhookEvent,
  Provider,
  JazzCashConfig,
  EasyPaisaConfig,
  StripeConfig,
  PaymentStatus,
  Currency,
  ProviderAdapter,
} from './types/index.js';

export {
  PkPayError,
  ProviderError,
  ValidationError,
  ConfigurationError,
} from './types/index.js';

export { withRetry } from './utils/retry.js';
export { generateIdempotencyKey, resolveIdempotencyKey } from './utils/idempotency.js';

// ─── Singleton State ──────────────────────────────────────────────────────────

let globalConfig: PkPayConfigResolved | null = null;
const adapterCache = new Map<Provider, ProviderAdapter>();

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Initialize the pk-pay SDK with provider credentials.
 * Call this once at application startup.
 *
 * @throws {ValidationError} if config is invalid
 */
export function configure(config: PkPayConfig): void {
  const result = PkPayConfigSchema.safeParse(config);
  if (!result.success) {
    throw new ValidationError(
      `Invalid pk-pay configuration: ${result.error.message}`,
    );
  }
  globalConfig = result.data;
  adapterCache.clear(); // Reset adapter cache on reconfigure
}

/**
 * Returns a new PkPay client instance (alternative to global configure/createPayment).
 * Useful for multi-tenant apps where you need separate configs per tenant.
 */
export function createClient(config: PkPayConfig): PkPayClient {
  return new PkPayClient(config);
}

// ─── Adapter Factory ──────────────────────────────────────────────────────────

function getAdapter(provider: Provider, config: PkPayConfigResolved): ProviderAdapter {
  if (adapterCache.has(provider)) {
    return adapterCache.get(provider)!;
  }

  let adapter: ProviderAdapter;

  switch (provider) {
    case 'jazzcash': {
      if (!config.jazzcash) {
        throw new ConfigurationError(
          'JazzCash config is required. Pass jazzcash: { merchantId, password, integritySalt } to configure().',
          'jazzcash',
        );
      }
      adapter = new JazzCashAdapter({
        ...config.jazzcash,
        environment: config.jazzcash.environment ?? config.environment,
      });
      break;
    }
    case 'easypaisa': {
      if (!config.easypaisa) {
        throw new ConfigurationError(
          'EasyPaisa config is required. Pass easypaisa: { storeId, hashKey, username, password } to configure().',
          'easypaisa',
        );
      }
      adapter = new EasyPaisaAdapter({
        ...config.easypaisa,
        environment: config.easypaisa.environment ?? config.environment,
      });
      break;
    }
    case 'stripe': {
      if (!config.stripe) {
        throw new ConfigurationError(
          'Stripe config is required. Pass stripe: { secretKey } to configure().',
          'stripe',
        );
      }
      adapter = new StripeAdapter({
        ...config.stripe,
        environment: config.stripe.environment ?? config.environment,
      });
      break;
    }
  }

  adapterCache.set(provider, adapter);
  return adapter;
}

// ─── Global API ───────────────────────────────────────────────────────────────

/**
 * Create a payment using the globally configured provider.
 *
 * @throws {ConfigurationError} if configure() has not been called or provider config is missing
 * @throws {ValidationError} if the request is invalid
 * @throws {ProviderError} if the payment provider returns an error
 */
export async function createPayment(
  request: PaymentRequest,
): Promise<PaymentResult> {
  if (!globalConfig) {
    throw new ConfigurationError(
      'pk-pay is not configured. Call configure() before createPayment().',
    );
  }

  return executePayment(request, globalConfig);
}

/**
 * Verify and parse an incoming webhook from a payment provider.
 *
 * @param provider - Which provider the webhook is from
 * @param payload - Raw request body (string for Stripe, object for JazzCash/EasyPaisa)
 * @param signature - Provider signature header value (required for Stripe)
 *
 * @throws {ConfigurationError} if configure() has not been called
 * @throws {ProviderError} if signature verification fails
 */
export async function verifyWebhook(
  provider: Provider,
  payload: string | Record<string, unknown>,
  signature?: string,
): Promise<WebhookEvent> {
  if (!globalConfig) {
    throw new ConfigurationError(
      'pk-pay is not configured. Call configure() before verifyWebhook().',
    );
  }

  const adapter = getAdapter(provider, globalConfig);
  return adapter.verifyWebhook(payload, signature);
}

// ─── Internal executor ────────────────────────────────────────────────────────

async function executePayment(
  request: PaymentRequest,
  config: PkPayConfigResolved,
): Promise<PaymentResult> {
  const parsed = PaymentRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid payment request: ${parsed.error.message}`,
      request.provider,
    );
  }

  const idempotencyKey = resolveIdempotencyKey(parsed.data.idempotencyKey);
  const adapter = getAdapter(parsed.data.provider, config);

  return withRetry(
    () => adapter.createPayment(parsed.data, idempotencyKey),
    { maxAttempts: config.maxRetries },
  );
}

// ─── PkPayClient Class (non-singleton alternative) ────────────────────────────

/**
 * Stateful client class — alternative to global configure() / createPayment().
 *
 * @example
 * ```typescript
 * const client = createClient({
 *   environment: 'sandbox',
 *   jazzcash: { merchantId: '...', password: '...', integritySalt: '...' },
 * });
 *
 * const payment = await client.createPayment({ provider: 'jazzcash', ... });
 * ```
 */
export class PkPayClient {
  private readonly config: PkPayConfigResolved;
  private readonly adapters = new Map<Provider, ProviderAdapter>();

  constructor(config: PkPayConfig) {
    const result = PkPayConfigSchema.safeParse(config);
    if (!result.success) {
      throw new ValidationError(
        `Invalid pk-pay configuration: ${result.error.message}`,
      );
    }
    this.config = result.data;
  }

  private getAdapter(provider: Provider): ProviderAdapter {
    if (!this.adapters.has(provider)) {
      const adapter = getAdapterForConfig(provider, this.config);
      this.adapters.set(provider, adapter);
    }
    return this.adapters.get(provider)!;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    return executePaymentWithAdapters(request, this.config, (p) =>
      this.getAdapter(p),
    );
  }

  async verifyWebhook(
    provider: Provider,
    payload: string | Record<string, unknown>,
    signature?: string,
  ): Promise<WebhookEvent> {
    return this.getAdapter(provider).verifyWebhook(payload, signature);
  }
}

// Extracted so both global and class approach can reuse
function getAdapterForConfig(provider: Provider, config: PkPayConfigResolved): ProviderAdapter {
  switch (provider) {
    case 'jazzcash': {
      if (!config.jazzcash) throw new ConfigurationError('JazzCash config missing', 'jazzcash');
      return new JazzCashAdapter({ ...config.jazzcash, environment: config.jazzcash.environment ?? config.environment });
    }
    case 'easypaisa': {
      if (!config.easypaisa) throw new ConfigurationError('EasyPaisa config missing', 'easypaisa');
      return new EasyPaisaAdapter({ ...config.easypaisa, environment: config.easypaisa.environment ?? config.environment });
    }
    case 'stripe': {
      if (!config.stripe) throw new ConfigurationError('Stripe config missing', 'stripe');
      return new StripeAdapter({ ...config.stripe, environment: config.stripe.environment ?? config.environment });
    }
  }
}

async function executePaymentWithAdapters(
  request: PaymentRequest,
  config: PkPayConfigResolved,
  getAdapter: (p: Provider) => ProviderAdapter,
): Promise<PaymentResult> {
  const parsed = PaymentRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new ValidationError(`Invalid payment request: ${parsed.error.message}`, request.provider);
  }

  const idempotencyKey = resolveIdempotencyKey(parsed.data.idempotencyKey);
  const adapter = getAdapter(parsed.data.provider);

  return withRetry(
    () => adapter.createPayment(parsed.data, idempotencyKey),
    { maxAttempts: config.maxRetries },
  );
}

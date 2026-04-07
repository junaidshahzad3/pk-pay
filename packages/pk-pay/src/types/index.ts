import { z } from 'zod';

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ProviderSchema = z.string().describe('Payment provider identifier');
export type Provider = string;

/** Standard provider identifiers for convenience */
export const PROVIDERS = {
  JAZZCASH: 'jazzcash',
  EASYPAISA: 'easypaisa',
  STRIPE: 'stripe',
} as const;

// ─── Environment ──────────────────────────────────────────────────────────────

export const EnvironmentSchema = z.string().describe('Deployment environment (e.g., sandbox, production)');
export type Environment = string;

/** Standard environment names */
export const ENVIRONMENTS = {
  SANDBOX: 'sandbox',
  PRODUCTION: 'production',
} as const;

// ─── Currency ─────────────────────────────────────────────────────────────────

export const CurrencySchema = z.string().toUpperCase().length(3).describe('ISO 4217 3-letter currency code');
export type Currency = string;

/** Common currency codes for convenience */
export const CURRENCIES = {
  PKR: 'PKR',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
} as const;

export const PaymentStatusSchema = z.string().describe('Unified payment status');
export type PaymentStatus = string;

/** Common payment statuses for convenience */
export const STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

// ─── Payment Request ──────────────────────────────────────────────────────────

export const PaymentRequestSchema = z.object({
  /** Which payment provider to use */
  provider: ProviderSchema,
  /** Payment amount in smallest currency unit (e.g., paisas for PKR) */
  amount: z.number().int().positive(),
  /** Currency code */
  currency: CurrencySchema.default('PKR'),
  /** Human-readable description of the payment */
  description: z.string().min(1).max(500),
  /** URL to redirect the customer after payment */
  returnUrl: z.string().url(),
  /** Optional reference ID in your system */
  orderId: z.string().optional(),
  /** Optional customer phone (required by JazzCash/EasyPaisa) */
  customerPhone: z.string().optional(),
  /** Optional customer email */
  customerEmail: z.string().email().optional(),
  /** Optional idempotency key (auto-generated if not provided) */
  idempotencyKey: z.string().optional(),
  /** Optional provider-specific extra options */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

// ─── Payment Result ───────────────────────────────────────────────────────────

export interface PaymentResult {
  /** Which provider processed this payment */
  provider: Provider;
  /** Unique transaction ID assigned by the provider */
  transactionId: string;
  /** Idempotency key used for this request */
  idempotencyKey: string;
  /** Unified payment status */
  status: PaymentStatus;
  /** Amount that was charged */
  amount: number;
  /** Currency */
  currency: Currency;
  /** URL to redirect the customer to for hosted checkout (if applicable) */
  redirectUrl?: string;
  /** HTTP method to use for redirect (default: 'GET') */
  redirectMethod?: 'GET' | 'POST';
  /** HTML auto-submit form for POST redirects (primarily for JazzCash/EasyPaisa) */
  redirectForm?: string;
  /** ISO timestamp of the payment */
  createdAt: string;
  /** Raw provider response — useful for debugging / audit logging */
  raw: unknown;
}

// ─── Webhook Event ────────────────────────────────────────────────────────────

export interface WebhookEvent {
  provider: Provider;
  eventType: string;
  transactionId: string;
  status: PaymentStatus;
  amount?: number | undefined;
  currency?: Currency | undefined;
  raw: unknown;
}

// ─── Provider Configs ─────────────────────────────────────────────────────────

export const JazzCashConfigSchema = z.object({
  merchantId: z.string().min(1),
  password: z.string().min(1),
  integritySalt: z.string().min(1),
  version: z.string().default('2.0'),
  environment: EnvironmentSchema.default('sandbox'),
});
export type JazzCashConfig = z.infer<typeof JazzCashConfigSchema>;

export const EasyPaisaConfigSchema = z.object({
  /** 'legacy' for Hosted Checkout (HMAC), 'rest' for Modern API (RSA) */
  method: z.enum(['legacy', 'rest']).default('legacy'),
  storeId: z.string().min(1),
  /** Required for 'legacy' method */
  hashKey: z.string().min(1).optional(),
  /** Required for 'rest' method (RSA Private Key) */
  privateKey: z.string().min(1).optional(),
  /** Recommended for 'rest' method to verify incoming responses */
  easypaisaPublicKey: z.string().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  environment: EnvironmentSchema.default('sandbox'),
});
export type EasyPaisaConfig = z.infer<typeof EasyPaisaConfigSchema>;

export const StripeConfigSchema = z.object({
  secretKey: z.string().startsWith('sk_'),
  webhookSecret: z.string().startsWith('whsec_').optional(),
  environment: EnvironmentSchema.default('sandbox'),
});
export type StripeConfig = z.infer<typeof StripeConfigSchema>;

// ─── Top-level SDK Config ─────────────────────────────────────────────────────
export const PkPayConfigSchema = z.object({
  environment: EnvironmentSchema.default('sandbox'),
  jazzcash: JazzCashConfigSchema.optional(),
  easypaisa: EasyPaisaConfigSchema.optional(),
  stripe: StripeConfigSchema.optional(),
  /** Max retry attempts for failed requests (default: 3) */
  maxRetries: z.number().int().min(0).max(5).default(3),
  /** Request timeout in milliseconds (default: 30000) */
  timeout: z.number().int().positive().default(30_000),
}).catchall(z.unknown());

/** Input configuration passed by the user */
export type PkPayConfig = z.input<typeof PkPayConfigSchema>;
/** Fully resolved configuration with defaults applied */
export type PkPayConfigResolved = z.output<typeof PkPayConfigSchema>;

// ─── Provider Adapter Interface ───────────────────────────────────────────────

export interface ProviderAdapter {
  createPayment(
    request: PaymentRequest,
    idempotencyKey: string,
  ): Promise<PaymentResult>;

  verifyWebhook(
    payload: string | Record<string, unknown>,
    signature?: string,
  ): Promise<WebhookEvent>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PkPayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: Provider,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'PkPayError';
  }
}

export class ProviderError extends PkPayError {
  constructor(
    message: string,
    provider: Provider,
    public readonly httpStatus?: number,
    raw?: unknown,
  ) {
    super(message, 'PROVIDER_ERROR', provider, raw);
    this.name = 'ProviderError';
  }
}

export class ValidationError extends PkPayError {
  constructor(message: string, provider?: Provider) {
    super(message, 'VALIDATION_ERROR', provider);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends PkPayError {
  constructor(message: string, provider?: Provider) {
    super(message, 'CONFIGURATION_ERROR', provider);
    this.name = 'ConfigurationError';
  }
}

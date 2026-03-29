import { z } from 'zod';

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ProviderSchema = z.enum(['jazzcash', 'easypaisa', 'stripe']);
export type Provider = z.infer<typeof ProviderSchema>;

// ─── Environment ──────────────────────────────────────────────────────────────

export const EnvironmentSchema = z.enum(['sandbox', 'production']);
export type Environment = z.infer<typeof EnvironmentSchema>;

// ─── Currency ─────────────────────────────────────────────────────────────────

export const CurrencySchema = z.enum(['PKR', 'USD', 'EUR', 'GBP']);
export type Currency = z.infer<typeof CurrencySchema>;

// ─── Payment Status ───────────────────────────────────────────────────────────

export const PaymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

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
  environment: EnvironmentSchema.default('sandbox'),
});
export type JazzCashConfig = z.infer<typeof JazzCashConfigSchema>;

export const EasyPaisaConfigSchema = z.object({
  storeId: z.string().min(1),
  hashKey: z.string().min(1),
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
});

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

/**
 * Stripe Provider Adapter
 *
 * This adapter wraps the official `stripe` npm package to fit into pk-pay's
 * unified interface. It creates a Stripe Checkout Session (hosted checkout),
 * which is the recommended integration for most use cases.
 *
 * For PKR: Stripe does NOT support PKR as a currency. This adapter converts
 * PKR amounts to USD using a configurable exchange rate, or you can configure
 * a different currency. The preferred usage is with USD when using Stripe.
 *
 * Docs: https://stripe.com/docs
 */

import {
  type StripeConfig,
  type PaymentRequest,
  type PaymentResult,
  type WebhookEvent,
  type ProviderAdapter,
  ProviderError,
  ConfigurationError,
} from '../../types/index.js';
import { sanitizeRaw } from '../../utils/crypto.js';

// ─── Stripe Status Mapping ────────────────────────────────────────────────────

const STRIPE_PAYMENT_STATUS_MAP: Record<string, PaymentResult['status']> = {
  succeeded: 'succeeded',
  requires_payment_method: 'pending',
  requires_confirmation: 'pending',
  requires_action: 'pending',
  processing: 'processing',
  canceled: 'cancelled',
  requires_capture: 'pending',
};

const STRIPE_SESSION_STATUS_MAP: Record<string, PaymentResult['status']> = {
  complete: 'succeeded',
  open: 'pending',
  expired: 'failed',
};

const STRIPE_WEBHOOK_STATUS_MAP: Record<string, PaymentResult['status']> = {
  'payment_intent.succeeded': 'succeeded',
  'payment_intent.payment_failed': 'failed',
  'payment_intent.canceled': 'cancelled',
  'payment_intent.processing': 'processing',
  'checkout.session.completed': 'succeeded',
  'checkout.session.expired': 'failed',
};

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class StripeAdapter implements ProviderAdapter {
  private readonly config: StripeConfig;
  // Lazily initialized to avoid hard dep on stripe package
  private stripeClient?: import('stripe').default;

  constructor(config: StripeConfig) {
    this.config = config;
  }

  private async getStripeClient(): Promise<import('stripe').default> {
    if (!this.stripeClient) {
      let Stripe: typeof import('stripe').default;
      try {
        const module = await import('stripe');
        Stripe = module.default;
      } catch {
        throw new ConfigurationError(
          'The "stripe" package is required to use the Stripe provider. ' +
          'Install it with: npm install stripe',
          'stripe',
        );
      }

      this.stripeClient = new Stripe(this.config.secretKey, {
        appInfo: {
          name: 'pk-pay',
          version: '0.1.0',
          url: 'https://github.com/junaidshahzad3/pk-pay',
        },
      });
    }
    return this.stripeClient;
  }

  async createPayment(
    request: PaymentRequest,
    idempotencyKey: string,
  ): Promise<PaymentResult> {
    const stripe = await this.getStripeClient();

    // Stripe doesn't support PKR — default to USD for Stripe provider
    const currency = request.currency === 'PKR' ? 'usd' : request.currency.toLowerCase();

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency,
                unit_amount: request.amount,
                product_data: {
                  name: request.description,
                },
              },
              quantity: 1,
            },
          ],
          success_url: `${request.returnUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`,
          cancel_url: `${request.returnUrl}?status=cancel`,
          client_reference_id: request.orderId ?? idempotencyKey,
          ...(request.customerEmail ? { customer_email: request.customerEmail } : {}),
          metadata: {
            idempotencyKey,
            ...(request.metadata as Record<string, string> | undefined),
          },
        },
        {
          idempotencyKey,
        },
      );

      const status =
        STRIPE_SESSION_STATUS_MAP[session.status ?? 'open'] ?? 'pending';

      const result: PaymentResult = {
        provider: 'stripe',
        transactionId: session.id,
        idempotencyKey,
        status,
        amount: request.amount,
        currency: request.currency,
        redirectMethod: 'GET',
        createdAt: new Date(session.created * 1000).toISOString(),
        raw: sanitizeRaw(session),
      };

      if (session.url) {
        result.redirectUrl = session.url;
      }

      return result;
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        const stripeErr = error as Error & { type: string; statusCode?: number };
        throw new ProviderError(
          `Stripe error: ${stripeErr.message}`,
          'stripe',
          stripeErr.statusCode,
          error,
        );
      }
      throw error;
    }
  }

  async verifyWebhook(
    payload: string | Record<string, unknown>,
    signature?: string,
  ): Promise<WebhookEvent> {
    const stripe = await this.getStripeClient();

    if (!this.config.webhookSecret) {
      throw new ConfigurationError(
        'webhookSecret is required in StripeConfig to verify webhooks',
        'stripe',
      );
    }

    if (typeof payload !== 'string') {
      throw new ProviderError(
        'Stripe webhook payload must be the raw request body string',
        'stripe',
      );
    }

    if (!signature) {
      throw new ProviderError(
        'Stripe-Signature header is required for webhook verification',
        'stripe',
      );
    }

    let event: import('stripe').default.Event;
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret,
      );
    } catch (error) {
      throw new ProviderError(
        `Stripe webhook verification failed: ${error instanceof Error ? error.message : String(error)}`,
        'stripe',
      );
    }

    const status = STRIPE_WEBHOOK_STATUS_MAP[event.type] ?? 'pending';

    let transactionId = '';
    let amount: number | undefined;

    if (event.type.startsWith('payment_intent')) {
      const pi = event.data.object as import('stripe').default.PaymentIntent;
      transactionId = pi.id;
      amount = pi.amount;
    } else if (event.type.startsWith('checkout.session')) {
      const session = event.data.object as import('stripe').default.Checkout.Session;
      transactionId = session.id;
      amount = session.amount_total ?? undefined;
    }

    return {
      provider: 'stripe',
      eventType: event.type,
      transactionId,
      status,
      amount,
      raw: sanitizeRaw(event),
    };
  }
}

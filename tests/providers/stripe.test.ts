import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeAdapter } from '../../src/providers/stripe/index.js';
import type { StripeConfig, PaymentRequest } from '../../src/types/index.js';
import { ConfigurationError, ProviderError, ValidationError } from '../../src/types/index.js';

const MOCK_CONFIG: StripeConfig = {
  secretKey: 'sk_test_fakekeyfortesting1234567890',
  webhookSecret: 'whsec_fakesecret1234567890',
  environment: 'sandbox',
};

const BASE_REQUEST: PaymentRequest = {
  provider: 'stripe',
  amount: 5000, // $50.00 USD in cents
  currency: 'USD',
  description: 'Pro Plan Subscription',
  returnUrl: 'https://example.com/payment/callback',
  customerEmail: 'user@example.com',
};

// Mock the stripe module
vi.mock('stripe', () => {
  const mockSession = {
    id: 'cs_test_abc123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
    status: 'open',
    created: 1710000000,
    amount_total: 5000,
  };

  const mockStripe = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(mockSession),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockStripe),
    __mockStripe: mockStripe,
  };
});

async function getMockStripe() {
  const mod = await import('stripe');
  return (mod as any).__mockStripe as {
    checkout: { sessions: { create: any } };
    webhooks: { constructEvent: any };
  };
}

describe('StripeAdapter', () => {
  let adapter: StripeAdapter;

  beforeEach(async () => {
    adapter = new StripeAdapter(MOCK_CONFIG);
    vi.clearAllMocks();
    // Reset mock return value
    const mockStripe = await getMockStripe();
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_abc123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
      status: 'open',
      created: 1710000000,
      amount_total: 5000,
    });
  });

  describe('createPayment', () => {
    it('returns a pending PaymentResult with Stripe checkout URL', async () => {
      const result = await adapter.createPayment(BASE_REQUEST, 'idem-stripe-1');

      expect(result.provider).toBe('stripe');
      expect(result.status).toBe('pending');
      expect(result.transactionId).toBe('cs_test_abc123');
      expect(result.redirectUrl).toContain('checkout.stripe.com');
      expect(result.idempotencyKey).toBe('idem-stripe-1');
    });

    it('calls stripe.checkout.sessions.create with correct params', async () => {
      const mockStripe = await getMockStripe();
      await adapter.createPayment(BASE_REQUEST, 'idem-stripe-2');

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'usd',
                unit_amount: 5000,
              }),
            }),
          ]),
          success_url: expect.stringContaining('example.com'),
          customer_email: 'user@example.com',
        }),
        { idempotencyKey: 'idem-stripe-2' },
      );
    });

    it('supports EUR and GBP without rewriting the amount', async () => {
      const mockStripe = await getMockStripe();
      await adapter.createPayment({ ...BASE_REQUEST, currency: 'EUR' }, 'idem-eur');
      await adapter.createPayment({ ...BASE_REQUEST, currency: 'GBP' }, 'idem-gbp');

      const eurArgs = mockStripe.checkout.sessions.create.mock.calls[0]?.[0] as any;
      const gbpArgs = mockStripe.checkout.sessions.create.mock.calls[1]?.[0] as any;

      expect(eurArgs.line_items[0]?.price_data.currency).toBe('eur');
      expect(eurArgs.line_items[0]?.price_data.unit_amount).toBe(5000);
      expect(gbpArgs.line_items[0]?.price_data.currency).toBe('gbp');
      expect(gbpArgs.line_items[0]?.price_data.unit_amount).toBe(5000);
    });

    it('allows PKR (passes it to Stripe API directly)', async () => {
      const mockStripe = await getMockStripe();
      await adapter.createPayment({ ...BASE_REQUEST, currency: 'PKR' }, 'idem-pkr');
      
      const args = mockStripe.checkout.sessions.create.mock.calls[0]?.[0] as any;
      expect(args.line_items[0]?.price_data.currency).toBe('pkr');
    });

    it('allows novel currencies like SAR or AED', async () => {
      const mockStripe = await getMockStripe();
      await adapter.createPayment({ ...BASE_REQUEST, currency: 'SAR' }, 'idem-sar');
      const sarArgs = mockStripe.checkout.sessions.create.mock.calls[0]?.[0] as any;
      expect(sarArgs.line_items[0]?.price_data.currency).toBe('sar');

      await adapter.createPayment({ ...BASE_REQUEST, currency: 'AED' }, 'idem-aed');
      const aedArgs = mockStripe.checkout.sessions.create.mock.calls[1]?.[0] as any;
      expect(aedArgs.line_items[0]?.price_data.currency).toBe('aed');
    });

    it('returns succeeded status when session status is complete', async () => {
      const mockStripe = await getMockStripe();
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_complete',
        url: 'https://checkout.stripe.com/pay/complete',
        status: 'complete',
        created: 1710000000,
        amount_total: 5000,
      });

      const result = await adapter.createPayment(BASE_REQUEST, 'idem-complete');
      expect(result.status).toBe('succeeded');
    });

    it('wraps Stripe API errors in ProviderError', async () => {
      const mockStripe = await getMockStripe();
      const stripeErr = Object.assign(new Error('No such customer'), {
        type: 'StripeInvalidRequestError',
        statusCode: 404,
      });
      mockStripe.checkout.sessions.create.mockRejectedValue(stripeErr);

      await expect(
        adapter.createPayment(BASE_REQUEST, 'idem-err'),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe('verifyWebhook', () => {
    const MOCK_EVENT = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_abc123',
          amount: 5000,
        },
      },
    };

    it('returns a succeeded WebhookEvent for payment_intent.succeeded', async () => {
      const mockStripe = await getMockStripe();
      mockStripe.webhooks.constructEvent.mockReturnValue(MOCK_EVENT);

      const event = await adapter.verifyWebhook(
        '{"raw":"body"}',
        'stripe-sig-header',
      );

      expect(event.provider).toBe('stripe');
      expect(event.status).toBe('succeeded');
      expect(event.transactionId).toBe('pi_abc123');
      expect(event.eventType).toBe('payment_intent.succeeded');
    });

    it('returns a failed WebhookEvent for payment_intent.payment_failed', async () => {
      const mockStripe = await getMockStripe();
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_fail', amount: 5000 } },
      });

      const event = await adapter.verifyWebhook('{}', 'sig');
      expect(event.status).toBe('failed');
    });

    it('throws ProviderError when webhookSecret is not configured', async () => {
      const adapterNoSecret = new StripeAdapter({
        secretKey: 'sk_test_fake',
        environment: 'sandbox',
      });
      await expect(adapterNoSecret.verifyWebhook('{}', 'sig')).rejects.toThrow(
        ConfigurationError,
      );
    });

    it('throws ProviderError when payload is not a string', async () => {
      await expect(
        adapter.verifyWebhook({ parsed: 'object' }, 'sig'),
      ).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError when signature is missing', async () => {
      await expect(adapter.verifyWebhook('{}', undefined)).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError when stripe signature verification fails', async () => {
      const mockStripe = await getMockStripe();
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      await expect(adapter.verifyWebhook('{}', 'bad-sig')).rejects.toThrow(ProviderError);
    });
  });
});

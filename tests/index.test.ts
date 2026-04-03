import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configure, createPayment, verifyWebhook, createClient, ConfigurationError, ValidationError } from '../src/index.ts';


vi.mock('../src/providers/jazzcash/index.js', () => ({
  JazzCashAdapter: vi.fn().mockImplementation(() => ({
    createPayment: vi.fn().mockResolvedValue({ transactionId: 'jc_123', status: 'pending' }),
    verifyWebhook: vi.fn().mockResolvedValue({ transactionId: 'jc_123', status: 'success' }),
  })),
}));

vi.mock('../src/providers/easypaisa/index.js', () => ({
  EasyPaisaAdapter: vi.fn().mockImplementation(() => ({
    createPayment: vi.fn().mockResolvedValue({ transactionId: 'ep_123', status: 'pending' }),
    verifyWebhook: vi.fn().mockResolvedValue({ transactionId: 'ep_123', status: 'success' }),
  })),
}));

vi.mock('../src/providers/stripe/index.js', () => ({
  StripeAdapter: vi.fn().mockImplementation(() => ({
    createPayment: vi.fn().mockResolvedValue({ transactionId: 'st_123', status: 'pending' }),
    verifyWebhook: vi.fn().mockResolvedValue({ transactionId: 'st_123', status: 'success' }),
  })),
}));

describe('pk-pay Core (index.ts)', () => {
  const validConfig = {
    environment: 'sandbox' as const,
    jazzcash: { merchantId: 'm1', password: 'p1', integritySalt: 's1', environment: 'sandbox' as const },
    easypaisa: { storeId: 's1', hashKey: 'h1', username: 'u1', password: 'p1', environment: 'sandbox' as const },
    stripe: { secretKey: 'sk_test_123', environment: 'sandbox' as const },
    maxRetries: 3,
    timeout: 30000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configure()', () => {
    it('throws ValidationError for invalid config', () => {
      // @ts-expect-error - testing invalid environment value
      expect(() => configure({ environment: 'invalid' })).toThrow(ValidationError);
    });

    it('sets global configuration', () => {
      expect(() => configure(validConfig)).not.toThrow();
    });
  });

  describe('createPayment()', () => {
    it('successfully routes to JazzCash', async () => {
      configure(validConfig);
      const result = await createPayment({
        provider: 'jazzcash',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      });
      expect(result.transactionId).toBe('jc_123');

      // Call again to test adapter cache coverage
      const result2 = await createPayment({
        provider: 'jazzcash',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      });
      expect(result2.transactionId).toBe('jc_123');
    });

    it('successfully routes to EasyPaisa', async () => {
      configure(validConfig);
      const result = await createPayment({
        provider: 'easypaisa',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      });
      expect(result.transactionId).toBe('ep_123');
    });

    it('successfully routes to Stripe', async () => {
      configure(validConfig);
      const result = await createPayment({
        provider: 'stripe',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      });
      expect(result.transactionId).toBe('st_123');
    });

    it('throws ConfigurationError if provider config is missing', async () => {
      configure({ environment: 'sandbox', stripe: { secretKey: 'sk_test_123', environment: 'sandbox' }, maxRetries: 3, timeout: 30000 });
      await expect(createPayment({
        provider: 'jazzcash',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      })).rejects.toThrow(ConfigurationError);

      await expect(createPayment({
        provider: 'easypaisa',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      })).rejects.toThrow(ConfigurationError);
    });

    it('throws ValidationError for invalid payment request', async () => {
      configure(validConfig);
      // @ts-expect-error - missing required fields in payment request
      await expect(createPayment({ provider: 'stripe' })).rejects.toThrow(ValidationError);
    });
  });

  describe('verifyWebhook()', () => {
    it('successfully routes to the correct provider', async () => {
      configure(validConfig);
      const event = await verifyWebhook('stripe', 'payload', 'sig');
      expect(event.transactionId).toBe('st_123');
    });
  });

  describe('createClient()', () => {
    it('creates a stateful client', async () => {
      const client = createClient(validConfig);
      const result = await client.createPayment({
        provider: 'stripe',
        amount: 1000,
        currency: 'PKR',
        description: 'Test',
        returnUrl: 'http://localhost',
      });
      expect(result.transactionId).toBe('st_123');
    });

    it('throws ValidationError for invalid client config', () => {
      // @ts-expect-error - testing invalid environment value for client
      expect(() => createClient({ environment: 'invalid' })).toThrow(ValidationError);
    });
  });
});

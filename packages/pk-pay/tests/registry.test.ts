import { describe, it, expect, beforeEach } from 'vitest';
import {
  configure,
  createClient,
  createPayment,
  verifyWebhook,
  registerProvider,
} from '../src/index.js';
import { ConfigurationError, ValidationError } from '../src/types/index.js';
import type { PaymentRequest } from '../src/types/index.js';

/**
 * Covers adapter resolution and configuration errors in the public entry point:
 * unknown providers, missing per-provider config, environment inheritance and
 * the "not configured yet" guards.
 */

const JAZZCASH = {
  version: '2.0' as const,
  merchantId: 'MC1',
  password: 'pw',
  integritySalt: 'salt',
};

const REQUEST: PaymentRequest = {
  provider: 'jazzcash',
  amount: 100_00,
  currency: 'PKR',
  description: 'registry test',
  returnUrl: 'https://example.com/cb',
  customerPhone: '03001234567',
};

describe('provider registry and configuration', () => {
  beforeEach(() => {
    configure({ jazzcash: JAZZCASH });
  });

  it('throws ConfigurationError for a provider with no registered adapter', async () => {
    const client = createClient({
      // A provider name the registry has never seen.
      himalaya: { apiKey: 'x' },
    } as any);

    await expect(
      client.createPayment({ ...REQUEST, provider: 'himalaya' as any }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('names the unknown provider and points at registerProvider', async () => {
    const client = createClient({ atlantis: { apiKey: 'x' } } as any);

    await expect(
      client.createPayment({ ...REQUEST, provider: 'atlantis' as any }),
    ).rejects.toThrow(/atlantis[\s\S]*registerProvider/);
  });

  it('throws ConfigurationError when the provider has no config block', async () => {
    // jazzcash is a known adapter, but this client was configured for stripe only.
    const client = createClient({ stripe: { secretKey: 'sk_test_123' } });

    await expect(client.createPayment(REQUEST)).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('inherits the top-level environment when the provider omits it', async () => {
    const client = createClient({
      environment: 'production',
      jazzcash: JAZZCASH, // no explicit environment here
    });

    const res = await client.createPayment(REQUEST);
    // The production host proves the top-level environment was applied.
    expect(res.redirectUrl).not.toContain('sandbox');
  });

  it('lets a provider-level environment win over the top-level one', async () => {
    const client = createClient({
      environment: 'production',
      jazzcash: { ...JAZZCASH, environment: 'sandbox' },
    });

    const res = await client.createPayment(REQUEST);
    expect(res.redirectUrl).toContain('sandbox');
  });

  it('rejects a structurally invalid payment request with ValidationError', async () => {
    await expect(
      // Missing returnUrl and a negative amount.
      createPayment({ ...REQUEST, amount: -1, returnUrl: undefined } as any),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('supports a custom adapter added through registerProvider', async () => {
    class FakeAdapter {
      constructor(public config: any) {}
      async createPayment(request: any, idempotencyKey: string) {
        return {
          provider: 'fakebank',
          transactionId: 'FAKE-1',
          idempotencyKey,
          status: 'pending' as const,
          amount: request.amount,
          currency: request.currency,
          createdAt: new Date().toISOString(),
          raw: { echoed: this.config.apiKey },
        };
      }
      async verifyWebhook() {
        return {
          provider: 'fakebank',
          eventType: 'payment.callback',
          transactionId: 'FAKE-1',
          status: 'succeeded' as const,
          currency: 'PKR',
          raw: {},
        };
      }
    }

    registerProvider('fakebank' as any, FakeAdapter as any);

    const client = createClient({ fakebank: { apiKey: 'k-123' } } as any);
    const res = await client.createPayment({ ...REQUEST, provider: 'fakebank' as any });

    expect(res.transactionId).toBe('FAKE-1');
    expect((res.raw as any).echoed).toBe('k-123');
  });

  it('verifyWebhook routes to the configured adapter', async () => {
    // An unsigned JazzCash body must be rejected by the adapter, proving the
    // call actually reached it rather than failing during resolution.
    await expect(verifyWebhook('jazzcash', { pp_TxnRefNo: 'T1' })).rejects.toThrow();
  });
});

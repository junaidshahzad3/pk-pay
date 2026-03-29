import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { EasyPaisaAdapter } from '../../src/providers/easypaisa/index.js';
import type { EasyPaisaConfig, PaymentRequest } from '../../src/types/index.js';
import { ConfigurationError, ProviderError } from '../../src/types/index.js';

const MOCK_CONFIG: EasyPaisaConfig = {
  storeId: 'TEST_STORE_ID',
  hashKey: 'TEST_HASH_KEY',
  username: 'test_user',
  password: 'test_pass',
  environment: 'sandbox',
};

const BASE_REQUEST: PaymentRequest = {
  provider: 'easypaisa',
  amount: 100_00, // 100.00 PKR in paisas = 100 rupees
  currency: 'PKR',
  description: 'Test EasyPaisa payment',
  returnUrl: 'https://example.com/callback',
  customerPhone: '03001234567',
  customerEmail: 'user@example.com',
};

function computeExpectedHash(params: Record<string, string>, hashKey: string): string {
  const sortedValues = Object.keys(params)
    .filter((k) => k !== 'hash' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`)
    .join('&');
  return createHmac('sha256', hashKey).update(sortedValues).digest('base64');
}

describe('EasyPaisaAdapter', () => {
  let adapter: EasyPaisaAdapter;

  beforeEach(() => {
    adapter = new EasyPaisaAdapter(MOCK_CONFIG);
  });

  describe('createPayment', () => {
    it('returns a pending PaymentResult with a redirectMethod POST and redirectForm', async () => {
      const result = await adapter.createPayment(BASE_REQUEST, 'idem-ep-123');

      expect(result.provider).toBe('easypaisa');
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(BASE_REQUEST.amount);
      expect(result.currency).toBe('PKR');
      expect(result.redirectUrl).toBeDefined();
      expect(result.redirectMethod).toBe('POST');
      expect(result.redirectForm).toContain('<form');
      expect(result.redirectForm).toContain('pk-pay-easypaisa-form');
      expect(result.transactionId).toBeDefined();
      expect(result.idempotencyKey).toBe('idem-ep-123');
      
      // Verify sanitization
      expect((result.raw as any).merchantHashedReq).toBe('[REDACTED]');
    });

    it('uses production URL when environment is production', async () => {
      const prodAdapter = new EasyPaisaAdapter({ ...MOCK_CONFIG, environment: 'production' });
      const result = await prodAdapter.createPayment(BASE_REQUEST, 'idem-prod');
      expect(result.redirectUrl).toContain('easypaycheckout.easypaisa.com.pk');
      expect(result.redirectForm).toContain('action="https://easypaycheckout.easypaisa.com.pk/easypay/"');
    });

    it('throws ConfigurationError when customerPhone is missing', async () => {
      await expect(
        adapter.createPayment({ ...BASE_REQUEST, customerPhone: undefined }, 'idem-no-phone'),
      ).rejects.toThrow(ConfigurationError);
    });

    it('converts amount from paisas to rupees correctly in redirectForm', async () => {
      const result = await adapter.createPayment(BASE_REQUEST, 'idem-amount');
      // 100_00 paisas = 100.00 rupees
      expect(result.redirectForm).toContain('name="amount" value="100.00"');
    });

    it('normalizes phone number from +92 to 0xxx format in redirectForm', async () => {
      const result = await adapter.createPayment(
        { ...BASE_REQUEST, customerPhone: '+923001234567' },
        'idem-phone',
      );
      expect(result.redirectForm).toContain('name="mobileNum" value="03001234567"');
    });

    it('redirectForm contains merchantHashedReq', async () => {
      const result = await adapter.createPayment(BASE_REQUEST, 'idem-hash');
      expect(result.redirectForm).toContain('name="merchantHashedReq"');
      expect(result.redirectForm).toContain('value="');
    });
  });

  describe('verifyWebhook', () => {
    function buildValidPayload(overrides: Record<string, string> = {}): Record<string, string> {
      const params: Record<string, string> = {
        refNum: 'EP123456789',
        orderRefNum: 'idem-ep-123',
        paymentStatus: '0000',
        amount: '100.00',
        storeId: MOCK_CONFIG.storeId,
        ...overrides,
      };
      params['merchantHashedReq'] = computeExpectedHash(params, MOCK_CONFIG.hashKey);
      return params;
    }

    it('returns a succeeded WebhookEvent for status 0000', async () => {
      const payload = buildValidPayload({ paymentStatus: '0000' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.provider).toBe('easypaisa');
      expect(event.status).toBe('succeeded');
      expect(event.transactionId).toBe('EP123456789');
      
      // Verify sanitization
      expect((event.raw as any).merchantHashedReq).toBe('[REDACTED]');
    });

    it('returns a failed WebhookEvent for status 0002', async () => {
      const payload = buildValidPayload({ paymentStatus: '0002' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.status).toBe('failed');
    });

    it('returns a cancelled WebhookEvent for status 0003', async () => {
      const payload = buildValidPayload({ paymentStatus: '0003' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.status).toBe('cancelled');
    });

    it('converts amount from rupees back to paisas', async () => {
      const payload = buildValidPayload({ amount: '100.00' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.amount).toBe(10_000); // 100.00 * 100
    });

    it('throws ProviderError when merchantHashedReq is missing', async () => {
      await expect(
        adapter.verifyWebhook({ refNum: 'EP123', paymentStatus: '0000' }),
      ).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError when hash does not match', async () => {
      const payload = buildValidPayload();
      payload['merchantHashedReq'] = 'invalid_hash_value';
      await expect(adapter.verifyWebhook(payload)).rejects.toThrow(ProviderError);
    });

    it('parses a URL-encoded string payload', async () => {
      const params = buildValidPayload();
      const urlEncoded = new URLSearchParams(params).toString();
      const event = await adapter.verifyWebhook(urlEncoded);
      expect(event.status).toBe('succeeded');
    });
  });
});

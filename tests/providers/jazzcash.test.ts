import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { JazzCashAdapter } from '../../src/providers/jazzcash/index.js';
import type { JazzCashConfig, PaymentRequest } from '../../src/types/index.js';
import { ConfigurationError, ProviderError } from '../../src/types/index.js';

const MOCK_CONFIG: JazzCashConfig = {
  version: '2.0',
  merchantId: 'TEST_MERCHANT',
  password: 'TEST_PASSWORD',
  integritySalt: 'TEST_SALT',
  environment: 'sandbox',
};

const BASE_REQUEST: PaymentRequest = {
  provider: 'jazzcash',
  amount: 100_000, // 1000.00 PKR in paisas
  currency: 'PKR',
  description: 'Test payment',
  returnUrl: 'https://example.com/callback',
  customerPhone: '03001234567',
};

function computeExpectedHash(
  params: Record<string, string>,
  salt: string,
): string {
  const sortedValues = Object.keys(params)
    .filter((k) => k.startsWith('pp_') && k !== 'pp_SecureHash' && params[k] !== '')
    .sort()
    .map((k) => params[k])
    .join('&');
  const data = `${salt}&${sortedValues}`;
  return createHmac('sha256', salt).update(data).digest('hex').toUpperCase();
}

describe('JazzCashAdapter', () => {
  let adapter: JazzCashAdapter;

  beforeEach(() => {
    adapter = new JazzCashAdapter(MOCK_CONFIG);
  });

  describe('createPayment', () => {
    it('returns a pending PaymentResult with a redirectMethod POST and redirectForm', async () => {
      const result = await adapter.createPayment(BASE_REQUEST, 'idempotency-key-123');

      expect(result.provider).toBe('jazzcash');
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(BASE_REQUEST.amount);
      expect(result.currency).toBe('PKR');
      expect(result.redirectUrl).toBeDefined();
      expect(result.redirectMethod).toBe('POST');
      expect(result.redirectForm).toContain('<form');
      expect(result.redirectForm).toContain('pk-pay-jazzcash-form');
      expect(result.transactionId).toBeDefined();
      expect(result.idempotencyKey).toBe('idempotency-key-123');
      expect(result.createdAt).toBeTruthy();
      
      // Verify sanitization
      expect((result.raw as any).pp_Password).toBe('[REDACTED]');
      
      // Verify amount conversion (100_000 paisas -> 1000 rupees)
      expect(result.redirectForm).toContain('name="pp_Amount" value="1000"');
    });

    it('redirectForm contains a valid pp_SecureHash hidden input', async () => {
      const result = await adapter.createPayment(BASE_REQUEST, 'idem-1');
      expect(result.redirectForm).toContain('name="pp_SecureHash"');
      const hashMatch = result.redirectForm!.match(/name="pp_SecureHash" value="([A-F0-9]{64})"/);
      expect(hashMatch).toBeTruthy();
    });

    it('uses production URL when environment is production', async () => {
      const prodAdapter = new JazzCashAdapter({ ...MOCK_CONFIG, environment: 'production' });
      const result = await prodAdapter.createPayment(BASE_REQUEST, 'idem-prod');
      expect(result.redirectUrl).toContain('jazzcash.com.pk/CustomerPortal');
      expect(result.redirectUrl).not.toContain('sandbox');
      expect(result.redirectForm).toContain('action="https://jazzcash.com.pk/CustomerPortal');
    });

    it('throws ConfigurationError when customerPhone is missing', async () => {
      const requestWithoutPhone: PaymentRequest = {
        ...BASE_REQUEST,
        customerPhone: undefined,
      };
      await expect(
        adapter.createPayment(requestWithoutPhone, 'idem-no-phone'),
      ).rejects.toThrow(ConfigurationError);
    });

    it('truncates description to 100 chars in redirectForm', async () => {
      const longDesc = 'A'.repeat(200);
      const result = await adapter.createPayment(
        { ...BASE_REQUEST, description: longDesc },
        'idem-long',
      );
      const descMatch = result.redirectForm!.match(/name="pp_Description" value="([^"]+)"/);
      expect(descMatch?.[1]?.length).toBeLessThanOrEqual(100);
    });

    it('uses orderId as BillReference when provided', async () => {
      const result = await adapter.createPayment(
        { ...BASE_REQUEST, orderId: 'order-abc-123' },
        'idem-order',
      );
      expect(result.redirectForm).toContain('name="pp_BillReference" value="order-abc-123"');
    });

    it('escapes dangerous HTML characters in redirectForm fields', async () => {
      const result = await adapter.createPayment(
        {
          ...BASE_REQUEST,
          description: `"><script>alert("x")</script>&`,
          orderId: `ord"'><tag>&`,
          returnUrl: 'https://example.com/callback?x="1"&y=<tag>',
          customerPhone: `0300"><script>1</script>`,
        },
        'idem-escape',
      );

      expect(result.redirectForm).toContain('&quot;&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;');
      expect(result.redirectForm).toContain('ord&quot;&#39;&gt;&lt;tag&gt;&amp;');
      expect(result.redirectForm).toContain('https://example.com/callback?x=&quot;1&quot;&amp;y=&lt;tag&gt;');
      expect(result.redirectForm).not.toContain('value=""><script>');
    });

    it('throws ValidationError for non-integer Rupee amounts', async () => {
      const invalidRequest: PaymentRequest = {
        ...BASE_REQUEST,
        amount: 1050, // 10.50 PKR - not allowed for JazzCash REST API
      };
      await expect(
        adapter.createPayment(invalidRequest, 'idem-invalid-amount'),
      ).rejects.toThrow('JazzCash amount must be a whole Rupee');
    });

    it('throws ValidationError for non-PKR currencies', async () => {
      const invalidRequest: PaymentRequest = {
        ...BASE_REQUEST,
        currency: 'USD',
      };
      await expect(
        adapter.createPayment(invalidRequest, 'idem-invalid-currency'),
      ).rejects.toThrow('JazzCash only supports PKR currency');
    });
  });

  describe('verifyWebhook', () => {
    function buildValidWebhookPayload(overrides: Record<string, string> = {}): Record<string, string> {
      const params: Record<string, string> = {
        pp_TxnRefNo: 'T1234567890',
        pp_Amount: '1000', // 1000 rupees
        pp_ResponseCode: '000',
        pp_ResponseMessage: 'SUCCESS',
        pp_TxnDateTime: '20260316143000',
        ...overrides,
      };
      params['pp_SecureHash'] = computeExpectedHash(params, MOCK_CONFIG.integritySalt);
      return params;
    }

    it('returns a succeeded WebhookEvent for response code 000', async () => {
      const payload = buildValidWebhookPayload({ pp_ResponseCode: '000', pp_Amount: '1000' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.provider).toBe('jazzcash');
      expect(event.status).toBe('succeeded');
      expect(event.transactionId).toBe('T1234567890');
      expect(event.amount).toBe(100_000); // 1000 rupees -> 100_000 paisas
    });

    it('returns a failed WebhookEvent for response code 109', async () => {
      const payload = buildValidWebhookPayload({ pp_ResponseCode: '109' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.status).toBe('failed');
    });

    it('returns a cancelled WebhookEvent for response code 121', async () => {
      const payload = buildValidWebhookPayload({ pp_ResponseCode: '121' });
      const event = await adapter.verifyWebhook(payload);
      expect(event.status).toBe('cancelled');
    });

    it('throws ProviderError when pp_SecureHash is missing', async () => {
      await expect(
        adapter.verifyWebhook({ pp_TxnRefNo: 'T123', pp_ResponseCode: '000' }),
      ).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError when hash does not match', async () => {
      const payload = buildValidWebhookPayload();
      payload['pp_SecureHash'] = 'INVALIDSIGNATURE';
      await expect(adapter.verifyWebhook(payload)).rejects.toThrow(ProviderError);
    });

    it('parses a URL-encoded string payload', async () => {
      const params = buildValidWebhookPayload();
      const urlEncoded = new URLSearchParams(params).toString();
      const event = await adapter.verifyWebhook(urlEncoded);
      expect(event.status).toBe('succeeded');
    });
  });
});

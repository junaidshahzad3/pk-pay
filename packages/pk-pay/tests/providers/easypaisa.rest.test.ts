import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync, createVerify, createSign } from 'crypto';
import { EasyPaisaAdapter } from '../../src/providers/easypaisa/index.js';
import type { EasyPaisaConfig, PaymentRequest } from '../../src/types/index.js';
import { ConfigurationError, ProviderError } from '../../src/types/index.js';

/**
 * Covers the modern REST (RSA-SHA256) integration method, which is documented in
 * PROVIDERS.md but previously had no test coverage at all.
 */

let privateKey: string;
let publicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
});

const restConfig = (): EasyPaisaConfig => ({
  method: 'rest',
  storeId: 'TEST_STORE_ID',
  privateKey,
  easypaisaPublicKey: publicKey,
  username: 'test_user',
  password: 'test_pass',
  environment: 'sandbox',
});

const BASE_REQUEST: PaymentRequest = {
  provider: 'easypaisa',
  amount: 250_00, // 250.00 PKR in paisas
  currency: 'PKR',
  description: 'REST mode payment',
  returnUrl: 'https://example.com/callback',
  customerPhone: '03001234567',
};

/** Rebuilds the signed payload the same way the adapter does. */
const canonical = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

describe('EasyPaisaAdapter — REST (RSA) method', () => {
  describe('createPayment', () => {
    it('returns a GET redirect carrying an RSA signature', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const res = await adapter.createPayment(BASE_REQUEST, 'idem-rest-0001');

      expect(res.provider).toBe('easypaisa');
      expect(res.status).toBe('pending');
      expect(res.redirectMethod).toBe('GET');
      expect(res.redirectUrl).toContain('rest/v2/handover?signature=');
      expect(res.amount).toBe(250_00);
    });

    it('produces a signature that verifies against the public key', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const res = await adapter.createPayment(BASE_REQUEST, 'idem-rest-0002');

      const raw = res.raw as Record<string, string>;
      const { signature, ...params } = raw;

      const verifier = createVerify('RSA-SHA256');
      verifier.update(canonical(params));
      expect(verifier.verify(publicKey, signature!, 'base64')).toBe(true);
    });

    it('normalizes a +92 phone number into local 0xxx form before signing', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const res = await adapter.createPayment(
        { ...BASE_REQUEST, customerPhone: '+923001234567' },
        'idem-rest-0003',
      );

      expect((res.raw as Record<string, string>).customerPhone).toBe('03001234567');
    });

    it('converts paisas to a two-decimal rupee string', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const res = await adapter.createPayment(
        { ...BASE_REQUEST, amount: 99_50 },
        'idem-rest-0004',
      );

      expect((res.raw as Record<string, string>).amount).toBe('99.50');
    });

    it('throws ConfigurationError when privateKey is absent', async () => {
      const adapter = new EasyPaisaAdapter({ ...restConfig(), privateKey: undefined });

      await expect(
        adapter.createPayment(BASE_REQUEST, 'idem-rest-0005'),
      ).rejects.toBeInstanceOf(ConfigurationError);
    });

    it('rejects a non-PKR currency', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());

      await expect(
        adapter.createPayment({ ...BASE_REQUEST, currency: 'USD' as any }, 'idem-rest-0006'),
      ).rejects.toThrow(/PKR/);
    });
  });

  describe('verifyWebhook', () => {
    /** Signs a webhook body the way EasyPaisa's REST callback would. */
    const signPayload = (params: Record<string, string>) => {
      const signer = createSign('RSA-SHA256');
      signer.update(canonical(params));
      return signer.sign(privateKey, 'base64');
    };

    const callbackParams = () => ({
      orderRefNum: 'ORDER123',
      paymentStatus: '0000',
      amount: '250.00',
      refNum: 'TXN-9001',
    });

    it('accepts a correctly signed callback', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const params = callbackParams();
      const event = await adapter.verifyWebhook({ ...params, signature: signPayload(params) });

      expect(event.provider).toBe('easypaisa');
      expect(event.status).toBe('succeeded');
    });

    it('rejects a payload tampered with after signing', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const params = callbackParams();
      const signature = signPayload(params);

      // An attacker inflates the amount but cannot re-sign it.
      await expect(
        adapter.verifyWebhook({ ...params, amount: '999999.00', signature }),
      ).rejects.toBeInstanceOf(ProviderError);
    });

    it('rejects a signature produced by a different key', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const params = callbackParams();

      const rogue = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const signer = createSign('RSA-SHA256');
      signer.update(canonical(params));
      const forged = signer.sign(rogue.privateKey, 'base64');

      await expect(
        adapter.verifyWebhook({ ...params, signature: forged }),
      ).rejects.toBeInstanceOf(ProviderError);
    });

    it('throws when the signature field is missing entirely', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());

      await expect(adapter.verifyWebhook(callbackParams())).rejects.toBeInstanceOf(ProviderError);
    });

    it('throws when no EasyPaisa public key is configured', async () => {
      const adapter = new EasyPaisaAdapter({ ...restConfig(), easypaisaPublicKey: undefined });
      const params = callbackParams();

      await expect(
        adapter.verifyWebhook({ ...params, signature: signPayload(params) }),
      ).rejects.toBeInstanceOf(ProviderError);
    });

    it('accepts a URL-encoded string body', async () => {
      const adapter = new EasyPaisaAdapter(restConfig());
      const params = callbackParams();
      const signature = signPayload(params);

      const body = new URLSearchParams({ ...params, signature }).toString();
      const event = await adapter.verifyWebhook(body);

      expect(event.status).toBe('succeeded');
    });
  });
});

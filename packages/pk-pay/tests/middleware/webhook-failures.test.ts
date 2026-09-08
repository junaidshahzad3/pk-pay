import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookMiddleware } from '../../src/middleware/express/index.js';
import { createNextPagesWebhookHandler } from '../../src/middleware/nextjs/index.js';
import * as core from '../../src/index.js';

vi.mock('../../src/index.js', () => ({
  verifyWebhook: vi.fn(),
}));

/**
 * A forged or malformed webhook must never reach onSuccess, and must surface as a
 * 4xx rather than a thrown error that crashes the request handler. These are the
 * error branches of each adapter, which previously had no coverage.
 */

const mockRes = () => {
  const res: any = {
    statusCode: null,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe('webhook middleware failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Express', () => {
    it('responds 400 when signature verification fails', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('bad signature'));

      const onSuccess = vi.fn();
      const handler = createWebhookMiddleware('jazzcash', { onSuccess });

      const req: any = { body: { pp_TxnRefNo: 'T1' }, headers: {} };
      const res = mockRes();
      await handler(req, res, vi.fn());

      expect(onSuccess).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'bad signature' });
    });

    it('delegates to a custom onError instead of the default 400 response', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('forged'));

      const onError = vi.fn();
      const handler = createWebhookMiddleware('jazzcash', {
        onSuccess: vi.fn(),
        onError,
      });

      const req: any = { body: {}, headers: {} };
      const res = mockRes();
      await handler(req, res, vi.fn());

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
      // The default responder must not also fire.
      expect(res.statusCode).toBeNull();
    });

    it('normalizes a non-Error rejection into an Error for onError', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue('a bare string');

      const onError = vi.fn();
      const handler = createWebhookMiddleware('jazzcash', {
        onSuccess: vi.fn(),
        onError,
      });

      await handler({ body: {}, headers: {} } as any, mockRes(), vi.fn());

      expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0]![0].message).toBe('a bare string');
    });
  });

  describe('Next.js (Pages Router)', () => {
    it('rejects a Stripe webhook that has no raw body', async () => {
      const onSuccess = vi.fn();
      const handler = createNextPagesWebhookHandler('stripe', { onSuccess });

      // No rawBody: Stripe signatures cannot be verified against a parsed body.
      const req: any = { headers: {}, body: { parsed: true } };
      const res = mockRes();
      await handler(req, res);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(core.verifyWebhook).not.toHaveBeenCalled();
    });

    it('accepts a Stripe raw body supplied as a Buffer', async () => {
      vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: 'evt_1' } as any);

      const onSuccess = vi.fn();
      const handler = createNextPagesWebhookHandler('stripe', { onSuccess });

      const req: any = {
        headers: { 'stripe-signature': 'sig_abc' },
        rawBody: Buffer.from('{"id":"evt_1"}'),
      };
      const res = mockRes();
      await handler(req, res);

      expect(core.verifyWebhook).toHaveBeenCalledWith('stripe', '{"id":"evt_1"}', 'sig_abc');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ received: true });
    });

    it('takes the first value when the signature header arrives as an array', async () => {
      vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: 'evt_2' } as any);

      const handler = createNextPagesWebhookHandler('stripe', { onSuccess: vi.fn() });
      const req: any = {
        headers: { 'stripe-signature': ['sig_first', 'sig_second'] },
        rawBody: 'raw',
      };
      await handler(req, mockRes());

      expect(core.verifyWebhook).toHaveBeenCalledWith('stripe', 'raw', 'sig_first');
    });

    it('calls onError and still returns 400 when verification fails', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('tampered'));

      const onError = vi.fn();
      const onSuccess = vi.fn();
      const handler = createNextPagesWebhookHandler('jazzcash', { onSuccess, onError });

      const req: any = { headers: {}, body: { pp_TxnRefNo: 'T2' } };
      const res = mockRes();
      await handler(req, res);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
      // Unlike Express, the Next handler always answers the request itself.
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'tampered' });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextWebhookHandler, createNextPagesWebhookHandler } from '../../src/middleware/nextjs/index.js';
import * as core from '../../src/index.js';

vi.mock('../../src/index.js', () => ({
  verifyWebhook: vi.fn(),
}));

// Mocking Response globally or using a local one
if (typeof Response === 'undefined') {
  (global as any).Response = class {
    constructor(public body: any, public init: any) {}
    static json(body: any, init: any) { return new Response(JSON.stringify(body), init); }
  };
}

describe('Next.js Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNextWebhookHandler (App Router)', () => {
    const mockReq = {
      headers: { get: vi.fn() },
      text: vi.fn(),
      json: vi.fn(),
      formData: vi.fn(),
    } as any;

    it('handles Stripe text body', async () => {
      mockReq.headers.get.mockImplementation((name: string) => 
        name === 'content-type' ? 'application/json' : null
      );
      mockReq.text.mockResolvedValue('raw_body');
      vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: '123' } as any);

      const handler = createNextWebhookHandler('stripe', { onSuccess: vi.fn() });
      const resp = await handler(mockReq);

      expect(core.verifyWebhook).toHaveBeenCalledWith('stripe', 'raw_body', undefined);
      expect(resp.status).toBe(200);
    });

    it('handles JazzCash form body', async () => {
      mockReq.headers.get.mockImplementation((name: string) => 
        name === 'content-type' ? 'application/x-www-form-urlencoded' : null
      );
      mockReq.text.mockResolvedValue('pp_Amount=1000&pp_TxId=123');
      vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: '123' } as any);

      const handler = createNextWebhookHandler('jazzcash', { onSuccess: vi.fn() });
      await handler(mockReq);

      expect(core.verifyWebhook).toHaveBeenCalledWith('jazzcash', { pp_Amount: '1000', pp_TxId: '123' }, undefined);
    });

    it('handles JSON body in App Router', async () => {
      mockReq.headers.get.mockReturnValue('application/json');
      mockReq.json.mockResolvedValue({ some: 'json' });
      vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: '123' } as any);

      const handler = createNextWebhookHandler('jazzcash', { onSuccess: vi.fn() });
      await handler(mockReq);

      expect(core.verifyWebhook).toHaveBeenCalledWith('jazzcash', { some: 'json' }, undefined);
    });

    it('returns 400 on error', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('Failed'));
      const handler = createNextWebhookHandler('stripe', { onSuccess: vi.fn() });
      const resp = await handler(mockReq);
      expect(resp.status).toBe(400);
    });

    it('uses custom onError Response', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('Failed'));
      const onError = vi.fn().mockResolvedValue(new Response('Custom Error', { status: 418 }));
      const handler = createNextWebhookHandler('stripe', { onSuccess: vi.fn(), onError });
      const resp = await handler(mockReq);
      expect(resp.status).toBe(418);
    });
  });

  describe('createNextPagesWebhookHandler (Pages Router)', () => {
    const mockReq = { headers: {}, body: { foo: 'bar' } } as any;
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    it('handles successful verification', async () => {
      vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: '123' } as any);
      const handler = createNextPagesWebhookHandler('jazzcash', { onSuccess: vi.fn() });
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });

    it('handles verification error in Pages Router', async () => {
      vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('Failed'));
      const handler = createNextPagesWebhookHandler('jazzcash', { onSuccess: vi.fn() });
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});

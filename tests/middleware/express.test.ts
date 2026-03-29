import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookMiddleware } from '../../src/middleware/express/index.ts';
import * as core from '../../src/index.ts';

vi.mock('../../src/index.js', () => ({
  verifyWebhook: vi.fn(),
}));

describe('Express Middleware', () => {
  const req = {
    body: { foo: 'bar' },
    headers: { 'stripe-signature': 'sig123' },
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onSuccess on successful verification', async () => {
    const event = { transactionId: 'tx_123', status: 'success' };
    vi.spyOn(core, 'verifyWebhook').mockResolvedValue(event as any);

    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const middleware = createWebhookMiddleware('stripe', { onSuccess });

    await middleware(req, res, next);

    expect(core.verifyWebhook).toHaveBeenCalledWith('stripe', JSON.stringify(req.body), 'sig123');
    expect(onSuccess).toHaveBeenCalledWith(event, req, res);
  });

  it('handles rawBody if present for Stripe', async () => {
    const reqWithRaw = { ...req, rawBody: Buffer.from('raw_body') };
    vi.spyOn(core, 'verifyWebhook').mockResolvedValue({} as any);

    const middleware = createWebhookMiddleware('stripe', { onSuccess: vi.fn() });
    await middleware(reqWithRaw, res, next);

    expect(core.verifyWebhook).toHaveBeenCalledWith('stripe', 'raw_body', 'sig123');
  });

  it('passes record payload to JazzCash', async () => {
    const middleware = createWebhookMiddleware('jazzcash', { onSuccess: vi.fn() });
    await middleware(req, res, next);

    expect(core.verifyWebhook).toHaveBeenCalledWith('jazzcash', req.body, undefined);
  });

  it('calls onError on verification failure', async () => {
    const error = new Error('Verification failed');
    vi.spyOn(core, 'verifyWebhook').mockRejectedValue(error);

    const onError = vi.fn().mockResolvedValue(undefined);
    const middleware = createWebhookMiddleware('stripe', { onSuccess: vi.fn(), onError });

    await middleware(req, res, next);

    expect(onError).toHaveBeenCalledWith(error, req, res);
  });

  it('responds with 400 by default on error', async () => {
    const error = new Error('Failed');
    vi.spyOn(core, 'verifyWebhook').mockRejectedValue(error);

    const middleware = createWebhookMiddleware('stripe', { onSuccess: vi.fn() });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed' });
  });
});

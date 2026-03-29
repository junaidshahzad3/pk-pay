import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pkPayWebhookPlugin } from '../../src/middleware/fastify/index.js';
import * as core from '../../src/index.js';

vi.mock('../../src/index.js', () => ({
  verifyWebhook: vi.fn(),
}));

describe('Fastify Middleware', () => {
  const fastify = {
    post: vi.fn(),
  } as any;
  const request = {
    headers: { 'stripe-signature': 'sig123' },
    body: { foo: 'bar' },
  } as any;
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue(undefined),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the POST route', async () => {
    const plugin = pkPayWebhookPlugin({
      provider: 'stripe',
      onSuccess: vi.fn(),
    });

    await (plugin as any)(fastify, {}, () => {});
    expect(fastify.post).toHaveBeenCalledWith('/webhook', expect.any(Function));
  });

  it('handles successful webhook', async () => {
    const plugin = pkPayWebhookPlugin({
      provider: 'stripe',
      onSuccess: vi.fn(),
    });

    await (plugin as any)(fastify, {}, () => {});
    const handler = fastify.post.mock.calls[0][1];

    vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: '123' } as any);
    const onSuccess = vi.fn();
    const plugin2 = pkPayWebhookPlugin({ provider: 'stripe', onSuccess });
    await (plugin2 as any)(fastify, {}, () => {});
    const handler2 = fastify.post.mock.calls[1][1];

    await handler2(request, reply);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handles JazzCash webhook (form body)', async () => {
    const plugin = pkPayWebhookPlugin({
      provider: 'jazzcash',
      onSuccess: vi.fn(),
    });
    await (plugin as any)(fastify, {}, () => {});
    const handler = fastify.post.mock.calls[0][1];

    vi.spyOn(core, 'verifyWebhook').mockResolvedValue({ id: 'jc_123' } as any);
    await handler({ ...request, body: { pp_TxId: 'jc_123' } }, reply);
    expect(core.verifyWebhook).toHaveBeenCalledWith('jazzcash', { pp_TxId: 'jc_123' }, undefined);
  });

  it('handles errors via default behavior', async () => {
    const plugin = pkPayWebhookPlugin({
      provider: 'stripe',
      onSuccess: vi.fn(),
    });
    await (plugin as any)(fastify, {}, () => {});
    const handler = fastify.post.mock.calls[0][1];

    vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('Failed'));
    await handler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Failed' });
  });

  it('calls custom onError', async () => {
    const onError = vi.fn();
    const plugin = pkPayWebhookPlugin({
      provider: 'stripe',
      onSuccess: vi.fn(),
      onError,
    });
    await (plugin as any)(fastify, {}, () => {});
    const handler = fastify.post.mock.calls[0][1];

    vi.spyOn(core, 'verifyWebhook').mockRejectedValue(new Error('Failed'));
    await handler(request, reply);

    expect(onError).toHaveBeenCalled();
  });
});

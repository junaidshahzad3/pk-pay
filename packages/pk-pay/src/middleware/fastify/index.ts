/**
 * pk-pay Fastify plugin
 *
 * Provides a webhook route plugin for Fastify applications.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { pkPayWebhookPlugin } from 'pk-pay/middleware/fastify';
 * import { configure } from 'pk-pay';
 *
 * configure({ ... });
 *
 * const app = Fastify();
 *
 * await app.register(pkPayWebhookPlugin, {
 *   provider: 'jazzcash',
 *   routePath: '/webhooks/jazzcash',
 *   onSuccess: async (event, request, reply) => {
 *     console.log('Payment succeeded:', event.transactionId);
 *     await reply.status(200).send({ received: true });
 *   },
 * });
 * ```
 */

import { verifyWebhook } from '../../index.js';
import type { Provider, WebhookEvent } from '../../types/index.js';

// Use structural typing so consumers don't need @types/fastify installed
// when they don't use this middleware
interface FastifyRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: Buffer;
}

interface FastifyReply {
  status(statusCode: number): FastifyReply;
  send(payload?: unknown): Promise<void>;
}

interface FastifyInstance {
  post(
    path: string,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  ): void;
  register(
    plugin: FastifyPlugin,
    options?: Record<string, unknown>,
  ): Promise<void>;
}

type FastifyPlugin = (
  instance: FastifyInstance,
  options: Record<string, unknown>,
  done: () => void,
) => void | Promise<void>;

export interface FastifyWebhookPluginOptions {
  /** Which payment provider this webhook is for */
  provider: Provider;
  /** The route path to register (default: '/webhook') */
  routePath?: string;
  /** Called on successful webhook verification */
  onSuccess: (
    event: WebhookEvent,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void>;
  /** Called on verification failure */
  onError?: (
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void>;
}

/**
 * A Fastify plugin that registers a webhook route for the specified provider.
 */
export function pkPayWebhookPlugin(options: FastifyWebhookPluginOptions): FastifyPlugin {
  const { provider, routePath = '/webhook', onSuccess, onError } = options;

  return async function plugin(fastify: FastifyInstance): Promise<void> {
    fastify.post(routePath, async (request, reply) => {
      try {
        let payload: string | Record<string, unknown>;
        let signature: string | undefined;

        if (provider === 'stripe') {
          payload =
            request.rawBody?.toString() ??
            (typeof request.body === 'string'
              ? request.body
              : JSON.stringify(request.body));
          const sigHeader = request.headers['stripe-signature'];
          signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
        } else {
          payload = request.body as Record<string, unknown>;
        }

        const event = await verifyWebhook(provider, payload, signature);
        await onSuccess(event, request, reply);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          await onError(err, request, reply);
        } else {
          await reply.status(400).send({ error: err.message });
        }
      }
    });
  };
}

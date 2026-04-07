/**
 * pk-pay Express.js middleware
 *
 * Provides a webhook handler factory for Express applications.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createWebhookMiddleware } from 'pk-pay/middleware/express';
 * import { configure } from 'pk-pay';
 *
 * configure({ ... });
 *
 * const app = express();
 *
 * // JazzCash/EasyPaisa: form-encoded webhook bodies
 * app.post(
 *   '/webhooks/jazzcash',
 *   express.urlencoded({ extended: true }),
 *   createWebhookMiddleware('jazzcash', {
 *     onSuccess: async (event, req, res) => {
 *       console.log('Payment succeeded:', event.transactionId);
 *       res.status(200).json({ received: true });
 *     },
 *     onError: async (error, req, res) => {
 *       console.error('Webhook error:', error);
 *       res.status(400).json({ error: error.message });
 *     },
 *   }),
 * );
 *
 * // Stripe: raw request body is required for signature verification
 * app.post(
 *   '/webhooks/stripe',
 *   express.raw({ type: 'application/json' }),
 *   createWebhookMiddleware('stripe', { onSuccess: async () => {} }),
 * );
 * ```
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyWebhook } from '../../index.js';
import type { Provider, WebhookEvent } from '../../types/index.js';

const STRIPE_RAW_BODY_ERROR =
  'Stripe webhook verification requires the raw request body. Configure express.raw({ type: "application/json" }) or expose req.rawBody before calling createWebhookMiddleware("stripe", ...).';

export interface WebhookMiddlewareOptions {
  /**
   * Called when the webhook is successfully verified and parsed.
   */
  onSuccess: (event: WebhookEvent, req: Request, res: Response) => Promise<void>;

  /**
   * Called when verification fails or an error occurs.
   * Default behavior: respond with 400 and error message.
   */
  onError?: (error: Error, req: Request, res: Response) => Promise<void>;
}

/**
 * Creates an Express middleware that verifies and processes webhooks
 * from the specified payment provider.
 *
 * Note: Ensure you use the appropriate body parser before this middleware:
 * - JazzCash / EasyPaisa: `express.urlencoded({ extended: true })` (IPN is form-encoded)
 * - Stripe: `express.raw({ type: 'application/json' })` (raw body required for sig verification)
 */
export function createWebhookMiddleware(
  provider: Provider,
  options: WebhookMiddlewareOptions,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let payload: string | Record<string, unknown>;
      let signature: string | undefined;

      if (provider === 'stripe') {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (!rawBody) {
          throw new Error(STRIPE_RAW_BODY_ERROR);
        }
        payload = rawBody.toString();
        signature = req.headers['stripe-signature'] as string | undefined;
      } else {
        // JazzCash and EasyPaisa send form-encoded POST data
        payload = req.body as Record<string, unknown>;
      }

      const event = await verifyWebhook(provider, payload, signature);
      await options.onSuccess(event, req, res);
    } catch (error) {
      if (options.onError) {
        await options.onError(error instanceof Error ? error : new Error(String(error)), req, res);
      } else {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Webhook verification failed',
        });
      }
    }

    void next;
  };
}

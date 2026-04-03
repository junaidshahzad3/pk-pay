/**
 * pk-pay Next.js App Router helpers
 *
 * Provides route handler factories for Next.js App Router (Next.js 13+).
 *
 * @example
 * ```typescript
 * // app/api/webhooks/stripe/route.ts
 * import { createNextWebhookHandler } from 'pk-pay/middleware/nextjs';
 * import { configure } from 'pk-pay';
 *
 * configure({ ... });
 *
 * export const POST = createNextWebhookHandler('stripe', {
 *   onSuccess: async (event) => {
 *     console.log('Payment succeeded:', event.transactionId);
 *     // Update your DB, etc.
 *   },
 * });
 * ```
 */

import { verifyWebhook } from '../../index.js';
import type { Provider, WebhookEvent } from '../../types/index.js';

const STRIPE_RAW_BODY_ERROR =
  'Stripe webhook verification requires the raw request body. Disable the default body parser and pass the raw body string to createNextPagesWebhookHandler("stripe", ...).';

// Structural types for Next.js Request/Response (avoids hard next dep)
interface NextRequest {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
  formData(): Promise<FormData>;
}

export interface NextWebhookHandlerOptions {
  /**
   * Called when webhook is successfully verified.
   * Return a Response object or undefined (auto-responds with 200 OK).
   */
  onSuccess: (event: WebhookEvent, req: NextRequest) => Promise<Response | void>;

  /**
   * Called when verification fails.
   * Return a Response or undefined (auto-responds with 400).
   */
  onError?: (error: Error, req: NextRequest) => Promise<Response | void>;
}

/**
 * Creates a Next.js App Router POST handler for webhook events.
 * Register it as `export const POST = createNextWebhookHandler(...)` in your route file.
 */
export function createNextWebhookHandler(
  provider: Provider,
  options: NextWebhookHandlerOptions,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    try {
      let payload: string | Record<string, unknown>;
      let signature: string | undefined;

      if (provider === 'stripe') {
        // Stripe requires raw text body for signature verification
        payload = await req.text();
        signature = req.headers.get('stripe-signature') ?? undefined;
      } else {
        // JazzCash and EasyPaisa send URL-encoded form data
        const contentType = req.headers.get('content-type') ?? '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const text = await req.text();
          payload = Object.fromEntries(new URLSearchParams(text));
        } else {
          payload = (await req.json()) as Record<string, unknown>;
        }
      }

      const event = await verifyWebhook(provider, payload, signature);
      const result = await options.onSuccess(event, req);

      if (result instanceof Response) return result;
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (options.onError) {
        const result = await options.onError(err, req);
        if (result instanceof Response) return result;
      }

      return new Response(
        JSON.stringify({ error: err.message }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };
}

/**
 * Legacy Pages Router helper (for Next.js 12 and below).
 *
 * @example
 * ```typescript
 * // pages/api/webhooks/stripe.ts
 * import { createNextPagesWebhookHandler } from 'pk-pay/middleware/nextjs';
 *
 * export const config = {
 *   api: {
 *     bodyParser: false,
 *   },
 * };
 *
 * export default createNextPagesWebhookHandler('stripe', { ... });
 * ```
 */
export function createNextPagesWebhookHandler(
  provider: Provider,
  options: NextWebhookHandlerOptions,
): (req: { headers: Record<string, string | string[] | undefined>; body: unknown; rawBody?: string | Buffer }, res: { status(n: number): { json(d: unknown): void } }) => Promise<void> {
  return async (req, res): Promise<void> => {
    try {
      let payload: string | Record<string, unknown>;
      const sigHeader = req.headers['stripe-signature'];
      const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

      if (provider === 'stripe') {
        if (typeof req.rawBody === 'string') {
          payload = req.rawBody;
        } else if (req.rawBody instanceof Buffer) {
          payload = req.rawBody.toString();
        } else {
          throw new Error(STRIPE_RAW_BODY_ERROR);
        }
      } else {
        payload = req.body as string | Record<string, unknown>;
      }

      const event = await verifyWebhook(provider, payload, signature);
      await options.onSuccess(event, req as unknown as NextRequest);
      res.status(200).json({ received: true });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (options.onError) {
        await options.onError(err, req as unknown as NextRequest);
      }
      res.status(400).json({ error: err.message });
    }
  };
}

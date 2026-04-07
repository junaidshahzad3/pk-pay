/**
 * Idempotency key utilities.
 *
 * Idempotency keys help correlate retries and duplicate submissions.
 * Stripe supports provider-enforced idempotency via a real request header.
 * JazzCash and EasyPaisa currently reuse merchant reference values instead of
 * sending provider-enforced idempotency headers.
 */

import { type Provider } from '../types/index.js';

/**
 * Generates a UUID v4 idempotency key.
 * Uses the Web Crypto API (available in Node.js >= 18).
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Resolves the idempotency key for a request:
 * - Uses the provided key if one was given
 * - Generates a new UUID v4 key otherwise
 */
export function resolveIdempotencyKey(provided?: string): string {
  return provided ?? generateIdempotencyKey();
}

/**
 * Returns the conventional idempotency header name for each provider.
 * Only Stripe currently uses this directly in API requests within pk-pay.
 * JazzCash and EasyPaisa reuse merchant-side reference fields instead.
 */
export function getIdempotencyHeader(provider: Provider): string {
  switch (provider) {
    case 'stripe':
      return 'Idempotency-Key';
    case 'jazzcash':
      return 'X-JazzCash-Idempotency-Key';
    case 'easypaisa':
      return 'X-EasyPaisa-Idempotency-Key';
    default:
      return `X-${provider.charAt(0).toUpperCase() + provider.slice(1)}-Idempotency-Key`;
  }
}

/**
 * Validates that an idempotency key meets minimum format requirements.
 * Keys must be 1-255 characters of printable ASCII.
 */
export function validateIdempotencyKey(key: string): boolean {
  return key.length >= 1 && key.length <= 255 && /^[\x20-\x7E]+$/.test(key);
}

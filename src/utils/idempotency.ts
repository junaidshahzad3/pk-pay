/**
 * Idempotency key utilities.
 *
 * Idempotency keys ensure that if a payment request is sent multiple times
 * (e.g., due to network timeouts), the provider only processes it once.
 * Each provider has different header name conventions — this module
 * abstracts that.
 */

import { type Provider } from '../types/index.js';

/**
 * Generates a UUID v4 idempotency key.
 * Uses the Web Crypto API (available in Node.js ≥ 18).
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
 * Returns the HTTP header name used by each provider for idempotency keys.
 * JazzCash and EasyPaisa use a custom order reference field;
 * Stripe uses the standard Idempotency-Key header.
 */
export function getIdempotencyHeader(provider: Provider): string {
  switch (provider) {
    case 'stripe':
      return 'Idempotency-Key';
    case 'jazzcash':
      return 'X-JazzCash-Idempotency-Key';
    case 'easypaisa':
      return 'X-EasyPaisa-Idempotency-Key';
  }
}

/**
 * Validates that an idempotency key meets minimum format requirements.
 * Keys must be 1–255 characters of printable ASCII.
 */
export function validateIdempotencyKey(key: string): boolean {
  return key.length >= 1 && key.length <= 255 && /^[\x20-\x7E]+$/.test(key);
}

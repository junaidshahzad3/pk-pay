import { timingSafeEqual } from 'crypto';

/**
 * Perform a timing-safe comparison of two strings.
 * This prevents timing attacks by ensuring the comparison time is independent 
 * of the content of the strings.
 * 
 * Note: While this function returns early on length mismatch (standard for 
 * cryptographic compare functions where hash lengths are fixed and public),
 * it uses Node's native `timingSafeEqual` for content comparison.
 */
export function safeCompare(received: string, expected: string): boolean {
  const receivedBuf = Buffer.from(received);
  const expectedBuf = Buffer.from(expected);

  if (receivedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(receivedBuf, expectedBuf);
}

/**
 * Recursively removes sensitive keys from an object before returning it 
 * to the user in the `raw` property.
 */
export function sanitizeRaw<T>(data: T): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeRaw) as unknown as T;
  }

  const sensitiveKeys = [
    'pp_Password',
    'pp_SecureHash',
    'merchantHashedReq',
    'hashKey',
    'integritySalt',
    'password',
    'secretKey',
    'privateKey',
    'webhookSecret',
    'signature',
    'hash',
  ];

  const sanitized = { ...data } as Record<string, unknown>;

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeRaw(sanitized[key]);
    }
  }

  return sanitized as T;
}

/**
 * Escapes a string for safe placement inside an HTML attribute value.
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

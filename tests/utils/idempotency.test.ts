import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  resolveIdempotencyKey,
  getIdempotencyHeader,
  validateIdempotencyKey,
} from '../../src/utils/idempotency.js';

describe('generateIdempotencyKey', () => {
  it('generates a valid UUID v4 string', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique keys on each call', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });
});

describe('resolveIdempotencyKey', () => {
  it('returns the provided key when given', () => {
    const key = 'my-custom-key-123';
    expect(resolveIdempotencyKey(key)).toBe(key);
  });

  it('generates a new UUID v4 key when no key is provided', () => {
    const key = resolveIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates a new key when undefined is passed', () => {
    const key = resolveIdempotencyKey(undefined);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });
});

describe('getIdempotencyHeader', () => {
  it('returns Idempotency-Key for stripe', () => {
    expect(getIdempotencyHeader('stripe')).toBe('Idempotency-Key');
  });

  it('returns X-JazzCash-Idempotency-Key for jazzcash', () => {
    expect(getIdempotencyHeader('jazzcash')).toBe('X-JazzCash-Idempotency-Key');
  });

  it('returns X-EasyPaisa-Idempotency-Key for easypaisa', () => {
    expect(getIdempotencyHeader('easypaisa')).toBe('X-EasyPaisa-Idempotency-Key');
  });
});

describe('validateIdempotencyKey', () => {
  it('accepts a valid UUID key', () => {
    expect(validateIdempotencyKey('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts a short valid key', () => {
    expect(validateIdempotencyKey('a')).toBe(true);
  });

  it('accepts a 255-char key', () => {
    expect(validateIdempotencyKey('a'.repeat(255))).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateIdempotencyKey('')).toBe(false);
  });

  it('rejects a key longer than 255 chars', () => {
    expect(validateIdempotencyKey('a'.repeat(256))).toBe(false);
  });

  it('rejects keys with non-printable ASCII characters', () => {
    expect(validateIdempotencyKey('key\x00null')).toBe(false);
    expect(validateIdempotencyKey('key\x1Fcontrol')).toBe(false);
  });

  it('accepts keys with printable special characters', () => {
    expect(validateIdempotencyKey('order-123_abc.v2')).toBe(true);
    expect(validateIdempotencyKey('key with spaces')).toBe(true);
  });
});

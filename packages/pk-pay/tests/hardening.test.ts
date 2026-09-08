import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import {
  configure,
  createClient,
  createPayment,
  registerProvider,
  resolveIdempotencyKey,
  validateIdempotencyKey,
  getIdempotencyHeader,
} from '../src/index.js';
import { sanitizeRaw, safeCompare, escapeHtmlAttribute } from '../src/utils/crypto.js';
import { formatToPKT } from '../src/utils/date.js';
import { ValidationError } from '../src/types/index.js';
import type { PaymentRequest } from '../src/types/index.js';

const JAZZCASH = {
  version: '2.0' as const,
  merchantId: 'MC1',
  password: 'pw',
  integritySalt: 'salt',
};

const REQUEST: PaymentRequest = {
  provider: 'jazzcash',
  amount: 100000,
  currency: 'PKR',
  description: 'hardening',
  returnUrl: 'https://shop.pk/cb',
  customerPhone: '03001234567',
};

describe('secret redaction', () => {
  it('redacts sensitive keys regardless of casing', () => {
    // Gateways are inconsistent about casing; a capitalised key must still go.
    const out = sanitizeRaw({
      Signature: 'abc',
      HASH: 'def',
      pp_password: 'hunter2',
      Merchant: 'visible',
    }) as Record<string, string>;

    expect(out.Signature).toBe('[REDACTED]');
    expect(out.HASH).toBe('[REDACTED]');
    expect(out.pp_password).toBe('[REDACTED]');
    expect(out.Merchant).toBe('visible');
  });

  it('redacts nested and array-nested secrets', () => {
    const out = sanitizeRaw({
      outer: { inner: { secretKey: 'sk_live_x', keep: 1 } },
      list: [{ signature: 'sig' }, { ok: 'yes' }],
    }) as any;

    expect(out.outer.inner.secretKey).toBe('[REDACTED]');
    expect(out.outer.inner.keep).toBe(1);
    expect(out.list[0].signature).toBe('[REDACTED]');
    expect(out.list[1].ok).toBe('yes');
  });

  it('accepts extra sensitive keys from the caller', () => {
    const out = sanitizeRaw({ cnic: '35202-1' }, ['cnic']) as Record<string, string>;
    expect(out.cnic).toBe('[REDACTED]');
  });

  it('passes primitives and null through untouched', () => {
    expect(sanitizeRaw(null)).toBeNull();
    expect(sanitizeRaw('plain')).toBe('plain');
    expect(sanitizeRaw(42)).toBe(42);
    expect(sanitizeRaw({ nested: null })).toEqual({ nested: null });
  });

  it('does not mutate the object it was given', () => {
    const input = { signature: 'keep-me' };
    sanitizeRaw(input);
    expect(input.signature).toBe('keep-me');
  });
});

describe('safeCompare', () => {
  it('matches identical strings and rejects different ones', () => {
    expect(safeCompare('ABCDEF', 'ABCDEF')).toBe(true);
    expect(safeCompare('ABCDEF', 'ABCDEG')).toBe(false);
  });

  it('rejects on length mismatch without throwing', () => {
    // timingSafeEqual throws on unequal buffer lengths; safeCompare must not.
    expect(() => safeCompare('short', 'muchlongervalue')).not.toThrow();
    expect(safeCompare('short', 'muchlongervalue')).toBe(false);
  });

  it('rejects the empty string against a real hash', () => {
    expect(safeCompare('', 'ABCDEF')).toBe(false);
  });

  it('is case sensitive, as hex comparison requires', () => {
    expect(safeCompare('abcdef', 'ABCDEF')).toBe(false);
  });
});

describe('escapeHtmlAttribute', () => {
  it('escapes every character that could break out of an attribute', () => {
    const out = escapeHtmlAttribute(`" onload='alert(1)' <b> & </b>`);
    expect(out).not.toContain('"');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('&quot;');
    expect(out).toContain('&#39;');
    expect(out).toContain('&lt;');
  });

  it('escapes ampersands first so entities are not double-encoded', () => {
    // If & were escaped last, '&quot;' would become '&amp;quot;'.
    expect(escapeHtmlAttribute('"')).toBe('&quot;');
    expect(escapeHtmlAttribute('&')).toBe('&amp;');
    expect(escapeHtmlAttribute('&amp;')).toBe('&amp;amp;');
  });

  it('keeps a quote out of the generated redirect form', async () => {
    configure({ jazzcash: JAZZCASH });
    const res = await createPayment({
      ...REQUEST,
      description: `evil" onload="alert(1)`,
      idempotencyKey: 'idem-escape-1',
    });
    // The raw quote must never appear unescaped inside an attribute value.
    expect(res.redirectForm).not.toContain('onload="alert(1)"');
    expect(res.redirectForm).toContain('&quot;');
  });
});

describe('formatToPKT', () => {
  it('renders PKT wall-clock time regardless of the host timezone', () => {
    // 2026-03-16T09:30:00Z is 14:30 in PKT (UTC+5).
    const d = new Date('2026-03-16T09:30:00.000Z');
    expect(formatToPKT(d, 'YYYYMMDDHHmmss')).toBe('20260316143000');
  });

  it('rolls the date forward when the +5 shift crosses midnight', () => {
    // 21:00Z on the 16th is 02:00 PKT on the 17th.
    const d = new Date('2026-03-16T21:00:00.000Z');
    expect(formatToPKT(d, 'YYYYMMDDHHmmss')).toBe('20260317020000');
  });

  it('zero-pads single-digit components', () => {
    const d = new Date('2026-01-02T00:04:05.000Z');
    expect(formatToPKT(d, 'YYYYMMDDHHmmss')).toBe('20260102050405');
  });

  it('preserves literal separators in the format string', () => {
    const d = new Date('2026-03-16T09:30:00.000Z');
    expect(formatToPKT(d, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-03-16 14:30:00');
  });
});

describe('idempotency keys', () => {
  it('generates a distinct v4 uuid each time', () => {
    const a = resolveIdempotencyKey();
    const b = resolveIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('passes a valid caller-supplied key straight through', () => {
    expect(resolveIdempotencyKey('order-2026-0001')).toBe('order-2026-0001');
  });

  it('rejects a key containing "&" because it corrupts the signed string', () => {
    // The key lands in pp_TxnRefNo, and signatures join field values on "&",
    // so an embedded "&" makes two different field sets hash identically.
    expect(validateIdempotencyKey('order&injected')).toBe(false);
    expect(() => resolveIdempotencyKey('order&injected')).toThrow(ValidationError);
  });

  it('rejects control characters and over-long keys', () => {
    expect(validateIdempotencyKey('bad\nkey')).toBe(false);
    expect(validateIdempotencyKey('')).toBe(false);
    expect(validateIdempotencyKey('x'.repeat(256))).toBe(false);
    expect(validateIdempotencyKey('x'.repeat(255))).toBe(true);
  });

  it('names the conventional header per provider', () => {
    expect(getIdempotencyHeader('stripe')).toBe('Idempotency-Key');
    expect(getIdempotencyHeader('jazzcash')).toBe('X-JazzCash-Idempotency-Key');
    expect(getIdempotencyHeader('custombank' as any)).toBe('X-Custombank-Idempotency-Key');
  });
});

describe('signature canonicalisation', () => {
  it('signs a returnUrl containing query parameters reproducibly', async () => {
    // Real return URLs carry "&". The hash must still match an independent
    // recomputation using the gateway's documented algorithm.
    configure({ jazzcash: JAZZCASH });
    const res = await createPayment({
      ...REQUEST,
      returnUrl: 'https://shop.pk/cb?order=1&source=web',
      idempotencyKey: 'idem-url-amp',
    });

    // The form escapes values for HTML, so decode before recomputing the hash.
    const unescape = (v: string) =>
      v
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

    const fields: Record<string, string> = {};
    const re = /name="(pp_[A-Za-z]+)" value="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(res.redirectForm!)) !== null) fields[m[1]!] = unescape(m[2]!);

    const joined = Object.keys(fields)
      .filter((k) => k !== 'pp_SecureHash' && fields[k] !== '')
      .sort()
      .map((k) => fields[k])
      .join('&');
    const expected = createHmac('sha256', JAZZCASH.integritySalt)
      .update(`${JAZZCASH.integritySalt}&${joined}`)
      .digest('hex')
      .toUpperCase();

    // Note: the emitted form escapes "&" as "&amp;", so compare on the decoded value.
    expect(fields['pp_SecureHash']).toBe(expected);
  });
});

describe('provider registry cache', () => {
  beforeEach(() => {
    configure({ jazzcash: JAZZCASH });
  });

  it('serves the new constructor after a provider is re-registered', async () => {
    class First {
      constructor(public c: any) {}
      async createPayment(r: any, k: string) {
        return { provider: 'swap', transactionId: 'FIRST', idempotencyKey: k,
          status: 'pending' as const, amount: r.amount, currency: r.currency,
          createdAt: new Date().toISOString(), raw: {} };
      }
      async verifyWebhook() { return {} as any; }
    }
    class Second extends First {
      override async createPayment(r: any, k: string) {
        return { ...(await super.createPayment(r, k)), transactionId: 'SECOND' };
      }
    }

    registerProvider('swap' as any, First as any);
    configure({ jazzcash: JAZZCASH, swap: { any: true } } as any);
    const one = await createPayment({ ...REQUEST, provider: 'swap' as any });
    expect(one.transactionId).toBe('FIRST');

    // Re-registering must invalidate the cached adapter built from `First`.
    registerProvider('swap' as any, Second as any);
    const two = await createPayment({ ...REQUEST, provider: 'swap' as any });
    expect(two.transactionId).toBe('SECOND');
  });

  it('keeps per-client adapters isolated from the global cache', async () => {
    const sandbox = createClient({ jazzcash: { ...JAZZCASH, environment: 'sandbox' } });
    const live = createClient({ jazzcash: { ...JAZZCASH, environment: 'production' } });

    const a = await sandbox.createPayment({ ...REQUEST, idempotencyKey: 'idem-iso-a' });
    const b = await live.createPayment({ ...REQUEST, idempotencyKey: 'idem-iso-b' });

    expect(a.redirectUrl).toContain('sandbox');
    expect(b.redirectUrl).not.toContain('sandbox');
  });
});

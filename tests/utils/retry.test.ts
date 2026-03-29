import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxAttempts times and then throws', async () => {
    const err = new Error('ECONNRESET');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 }),
    ).rejects.toThrow('ECONNRESET');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable errors', async () => {
    const err = new Error('Invalid API key');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 0,
        isRetryable: () => false,
      }),
    ).rejects.toThrow('Invalid API key');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses custom isRetryable predicate', async () => {
    const err = Object.assign(new Error('Provider error'), { httpStatus: 500 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      isRetryable: (e) =>
        e instanceof Error && 'httpStatus' in e && (e as { httpStatus: number }).httpStatus >= 500,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx httpStatus errors by default', async () => {
    const err = Object.assign(new Error('Server error'), { httpStatus: 503 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('ok');
  });

  it('does not retry on 4xx httpStatus errors by default', async () => {
    const err = Object.assign(new Error('Not found'), { httpStatus: 404 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts: 1 (no retries)', async () => {
    const err = new Error('ECONNRESET');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 1, baseDelayMs: 0 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

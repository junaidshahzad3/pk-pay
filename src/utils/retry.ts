/**
 * Exponential backoff retry utility with jitter.
 * Retries only on network errors or 5xx HTTP errors by default.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in milliseconds (default: 300ms) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 10000ms) */
  maxDelayMs?: number;
  /** Whether to add jitter to the delay (default: true) */
  jitter?: boolean;
  /** Optional predicate — return true if the error is retryable */
  isRetryable?: (error: unknown, attempt: number) => boolean;
}

/**
 * Default predicate for retryable errors.
 * Retries on network errors and 5xx status codes.
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const networkErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNABORTED',
      'NETWORK_ERROR',
      'fetch failed',
    ];
    if (networkErrors.some((e) => error.message.includes(e))) {
      return true;
    }

    // Retry on 5xx HTTP errors
    if ('httpStatus' in error) {
      const status = (error as { httpStatus?: number }).httpStatus;
      if (status !== undefined && status >= 500) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate delay for next retry with exponential backoff + optional jitter.
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: boolean,
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  if (!jitter) return capped;
  // Full jitter: random between 0 and capped
  return Math.floor(Math.random() * capped);
}

/**
 * Wraps an async function with retry logic using exponential backoff with jitter.
 *
 * @example
 * const result = await withRetry(() => fetch('https://api.example.com'), {
 *   maxAttempts: 3,
 *   baseDelayMs: 300,
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 10_000,
    jitter = true,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !isRetryable(error, attempt)) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);
      await sleep(delay);
    }
  }

  // Should never reach here, but satisfies TypeScript
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

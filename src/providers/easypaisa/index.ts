/**
 * EasyPaisa Provider Adapter
 *
 * EasyPaisa is Pakistan's leading fintech platform by Telenor.
 * This adapter implements the EasyPay Payment Gateway API which supports:
 * - OTC (Over-The-Counter) payments — customer pays at any EasyPaisa retailer
 * - MA (Mobile Account) payments — deduction from mobile account
 *
 * Docs: https://easypay.easypaisa.com.pk/
 * Sandbox portal: https://easypaystg.easypaisa.com.pk/
 */

import { createHash, createHmac } from 'crypto';
import {
  type EasyPaisaConfig,
  type PaymentRequest,
  type PaymentResult,
  type WebhookEvent,
  type ProviderAdapter,
  ProviderError,
  ConfigurationError,
} from '../../types/index.js';
import { safeCompare, sanitizeRaw } from '../../utils/crypto.js';
import { formatToPKT } from '../../utils/date.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASYPAISA_SANDBOX_URL = 'https://easypaystg.easypaisa.com.pk/easypay/';
const EASYPAISA_PRODUCTION_URL = 'https://easypaycheckout.easypaisa.com.pk/easypay/';

/**
 * EasyPaisa payment status codes mapping.
 */
const STATUS_MAP: Record<string, PaymentResult['status']> = {
  '0000': 'succeeded',    // Paid
  '0001': 'pending',      // Pending
  '0002': 'failed',       // Declined
  '0003': 'cancelled',    // Cancelled
  '0007': 'failed',       // Invalid credentials
  '0010': 'failed',       // Duplicate transaction
  '0011': 'failed',       // Invalid amount
  '0015': 'failed',       // Transaction not found
  '9999': 'failed',       // System error
};

// ─── Hash Computation ─────────────────────────────────────────────────────────

/**
 * EasyPaisa uses Base64-encoded HMAC-SHA256 for payload authentication.
 * The hash is computed over all parameter values sorted by key name.
 */
function computeHash(
  params: Record<string, string>,
  hashKey: string,
): string {
  const sortedValues = Object.keys(params)
    .filter((k) => k !== 'hash' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`)
    .join('&');

  return createHmac('sha256', hashKey)
    .update(sortedValues)
    .digest('base64');
}

/**
 * EasyPaisa uses MD5 hash for some legacy endpoints.
 * Kept for webhook verification compatibility.
 */
function computeMd5Hash(data: string, hashKey: string): string {
  return createHash('md5').update(data + hashKey).digest('hex').toUpperCase();
}

// ─── Date/Time helpers ────────────────────────────────────────────────────────

/** Format: yyyyMMdd HHmmss in PKT (UTC+5) */
function formatEasyPaisaDateTime(date: Date): string {
  return formatToPKT(date, 'YYYYMMDD HHmm ss');
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class EasyPaisaAdapter implements ProviderAdapter {
  private readonly config: EasyPaisaConfig;
  private readonly baseUrl: string;

  constructor(config: EasyPaisaConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? EASYPAISA_PRODUCTION_URL
        : EASYPAISA_SANDBOX_URL;
  }

  async createPayment(
    request: PaymentRequest,
    idempotencyKey: string,
  ): Promise<PaymentResult> {
    const { storeId, hashKey } = this.config;

    if (!request.customerPhone) {
      throw new ConfigurationError(
        'customerPhone is required for EasyPaisa payments',
        'easypaisa',
      );
    }

    const now = new Date();
    const orderRefNum = idempotencyKey.replace(/-/g, '').slice(0, 16);

    // EasyPaisa amounts are in PKR (whole units), not paisas
    const amountInRupees = (request.amount / 100).toFixed(2);

    const params: Record<string, string> = {
      storeId: storeId,
      amount: amountInRupees,
      postBackURL: request.returnUrl,
      orderRefNum: orderRefNum,
      expiryDate: formatEasyPaisaDateTime(
        new Date(now.getTime() + 60 * 60 * 1000),
      ),
      paymentMethod: 'MA_PAYMENT', // MA = Mobile Account
      emailAddr: request.customerEmail ?? '',
      mobileNum: request.customerPhone.replace(/^\+92/, '0'),
      recurringFlag: '0',
      recurringPeriodicityType: '',
      recurringPeriodicity: '',
      recurringEndDate: '',
      merchantHashedReq: '',
    };

    // Compute hash over all fields (excluding merchantHashedReq itself)
    const { merchantHashedReq: _ignored, ...hashParams } = params;
    params['merchantHashedReq'] = computeHash(hashParams, hashKey);

    // Build auto-submit HTML form for secure POST redirect
    const formFields = Object.entries(params)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
      .join('\n      ');

    const redirectForm = `
<form id="pk-pay-easypaisa-form" method="POST" action="${this.baseUrl}">
      ${formFields}
</form>
<script>document.getElementById("pk-pay-easypaisa-form").submit();</script>
    `.trim();

    return {
      provider: 'easypaisa',
      transactionId: orderRefNum,
      idempotencyKey,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      redirectUrl: this.baseUrl,
      redirectMethod: 'POST',
      redirectForm,
      createdAt: now.toISOString(),
      raw: sanitizeRaw(params),
    };
  }

  async verifyWebhook(
    payload: string | Record<string, unknown>,
  ): Promise<WebhookEvent> {
    const data: Record<string, string> =
      typeof payload === 'string'
        ? Object.fromEntries(new URLSearchParams(payload))
        : (payload as Record<string, string>);

    const receivedHash = data['merchantHashedReq'];
    if (!receivedHash) {
      throw new ProviderError(
        'Missing merchantHashedReq in EasyPaisa IPN payload',
        'easypaisa',
      );
    }

    // Verify hash
    const { merchantHashedReq: _h, ...paramsToHash } = data;
    const expectedHash = computeHash(paramsToHash, this.config.hashKey);

    if (!safeCompare(receivedHash, expectedHash)) {
      throw new ProviderError(
        'EasyPaisa webhook signature verification failed',
        'easypaisa',
      );
    }

    const statusCode = data['paymentStatus'] ?? '9999';
    const status = STATUS_MAP[statusCode] ?? 'failed';

    return {
      provider: 'easypaisa',
      eventType: 'payment.callback',
      transactionId: (data['refNum'] as string | undefined) ?? (data['orderRefNum'] as string | undefined) ?? '',
      status,
      amount: data['amount'] ? Math.round(Number(data['amount'] as string) * 100) : undefined,
      currency: 'PKR',
      raw: sanitizeRaw(data),
    };
  }
}

// Export the hash utilities for testing
export { computeHash as _computeHash, computeMd5Hash as _computeMd5Hash };

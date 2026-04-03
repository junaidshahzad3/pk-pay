/**
 * JazzCash Provider Adapter
 *
 * JazzCash is Pakistan's largest mobile payment platform by Jazz (Veon).
 * This adapter implements the REST Checkout API (v1.4) which supports:
 * - Redirect-based checkout (MWALLET + OTC)
 * - HMAC-SHA256 signature for transaction security
 *
 * Docs: https://sandbox.jazzcash.com.pk/
 * Sandbox portal: https://sandbox.jazzcash.com.pk/Home/RedirectMerchantAuthentication
 */

import { createHmac } from 'crypto';
import {
  type JazzCashConfig,
  type PaymentRequest,
  type PaymentResult,
  type WebhookEvent,
  type ProviderAdapter,
  ProviderError,
  ConfigurationError,
  ValidationError,
} from '../../types/index.js';
import { escapeHtmlAttribute, safeCompare, sanitizeRaw } from '../../utils/crypto.js';
import { formatToPKT } from '../../utils/date.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const JAZZCASH_SANDBOX_URL =
  'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';
const JAZZCASH_PRODUCTION_URL =
  'https://jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';

function renderHiddenInput(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtmlAttribute(name)}" value="${escapeHtmlAttribute(value)}" />`;
}

/**
 * JazzCash response codes mapping to unified PaymentStatus.
 * Reference: JazzCash REST API documentation.
 */
const RESPONSE_CODE_MAP: Record<
  string,
  PaymentResult['status']
> = {
  '000': 'succeeded',
  '200': 'succeeded',
  '001': 'pending',
  '157': 'failed',    // Transaction already processed
  '101': 'failed',    // Invalid credentials
  '102': 'failed',    // Invalid merchant ID
  '106': 'failed',    // Invalid transaction amount
  '109': 'failed',    // Transaction declined
  '111': 'failed',    // Invalid CNIC
  '115': 'failed',    // Inactive account
  '118': 'failed',    // Insufficient balance
  '121': 'cancelled', // Transaction cancelled by user
  '999': 'failed',    // Generic error
};

// ─── Hash Computation ─────────────────────────────────────────────────────────

/**
 * JazzCash HMAC-SHA256 signature.
 * Concatenates all sorted field values with ampersand, then HMAC-SHA256s the result.
 * Reference: JazzCash API docs Section 2.3.
 */
function computeHash(
  params: Record<string, string>,
  integritySalt: string,
): string {
  // Sort keys alphabetically, include only 'pp_' fields and non-empty values
  const sortedValues = Object.keys(params)
    .filter((k) => k.startsWith('pp_') && k !== 'pp_SecureHash' && params[k] !== '')
    .sort()
    .map((k) => params[k])
    .join('&');

  const data = `${integritySalt}&${sortedValues}`;
  return createHmac('sha256', integritySalt).update(data).digest('hex').toUpperCase();
}

// ─── Date/Time helpers ────────────────────────────────────────────────────────

/** Format: YYYYMMDDHHmmss in PKT (UTC+5) */
function formatJazzCashDateTime(date: Date): string {
  return formatToPKT(date, 'YYYYMMDDHHmmss');
}

/** Format: YYYYMMDDHHmmss in PKT, 1 hour in the future */
function formatExpiry(date: Date): string {
  const expiry = new Date(date.getTime() + 60 * 60 * 1000);
  return formatJazzCashDateTime(expiry);
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class JazzCashAdapter implements ProviderAdapter {
  private readonly config: JazzCashConfig;
  private readonly baseUrl: string;

  constructor(config: JazzCashConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? JAZZCASH_PRODUCTION_URL
        : JAZZCASH_SANDBOX_URL;
  }

  async createPayment(
    request: PaymentRequest,
    idempotencyKey: string,
  ): Promise<PaymentResult> {
    const { merchantId, password, integritySalt } = this.config;

    if (!request.customerPhone) {
      throw new ConfigurationError(
        'customerPhone is required for JazzCash payments',
        'jazzcash',
      );
    }

    const now = new Date();
    const txnDateTime = formatJazzCashDateTime(now);
    const txnExpiryDateTime = formatExpiry(now);
    const txnRefNo = idempotencyKey.replace(/-/g, '').slice(0, 20);

    // JazzCash expects amount in whole units (Rupees), but we standardize on Paisas.
    // Some versions of the REST API (especially redirection flow) strictly expect 
    // no decimals. We enforce whole Rupees to prevent rounding losses.
    if (request.amount % 100 !== 0) {
      throw new ValidationError(
        `JazzCash amount must be a whole Rupee (multiple of 100 paisas). Received: ${request.amount}.`,
        'jazzcash',
      );
    }
    const amountInRupees = request.amount / 100;

    const params: Record<string, string> = {
      pp_Version: this.config.version || '2.0',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: merchantId,
      pp_Password: password,
      pp_TxnRefNo: `T${txnRefNo}`,
      pp_Amount: String(amountInRupees),
      pp_TxnCurrency: request.currency,
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: request.orderId ?? txnRefNo,
      pp_Description: request.description.slice(0, 100),
      pp_TxnExpiryDateTime: txnExpiryDateTime,
      pp_ReturnURL: request.returnUrl,
      pp_MobileNumber: request.customerPhone,
      pp_CNIC: '',
    };

    const hash = computeHash(params, integritySalt);
    params['pp_SecureHash'] = hash;

    // Build auto-submit HTML form for secure POST redirect
    const formFields = Object.entries(params)
      .map(([k, v]) => renderHiddenInput(k, v))
      .join('\n      ');

    const redirectForm = `
<form id="pk-pay-jazzcash-form" method="POST" action="${escapeHtmlAttribute(this.baseUrl)}">
      ${formFields}
</form>
<script>document.getElementById("pk-pay-jazzcash-form").submit();</script>
    `.trim();

    return {
      provider: 'jazzcash',
      transactionId: params['pp_TxnRefNo'] ?? `T${txnRefNo}`,
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

    const receivedHash = data['pp_SecureHash'];
    if (!receivedHash) {
      throw new ProviderError(
        'Missing pp_SecureHash in JazzCash webhook payload',
        'jazzcash',
      );
    }

    const paramsWithoutHash: Record<string, string> = Object.fromEntries(
      Object.entries(data).filter(([k]) => k !== 'pp_SecureHash'),
    ) as Record<string, string>;

    const expectedHash = computeHash(paramsWithoutHash, this.config.integritySalt);

    if (!safeCompare(receivedHash.toUpperCase(), expectedHash)) {
      throw new ProviderError(
        'JazzCash webhook signature verification failed',
        'jazzcash',
      );
    }

    const responseCode = data['pp_ResponseCode'] ?? '999';
    const status = RESPONSE_CODE_MAP[responseCode] ?? 'failed';

    return {
      provider: 'jazzcash',
      eventType: 'payment.callback',
      transactionId: (data['pp_TxnRefNo'] as string | undefined) ?? '',
      status,
      amount: data['pp_Amount'] ? Number(data['pp_Amount'] as string) * 100 : undefined, // Convert back to paisas
      currency: 'PKR',
      raw: sanitizeRaw(data),
    };
  }
}

/**
 * EasyPaisa Provider Adapter
 *
 * EasyPaisa is Pakistan's leading fintech platform by Telenor.
 * This adapter implements the EasyPay Payment Gateway API which supports:
 * - Legacy Hosted Checkout (HMAC-SHA256)
 * - Modern REST API v2.0 (RSA-SHA256)
 *
 * Docs: https://easypay.easypaisa.com.pk/
 */

import { createHmac, createSign, createVerify } from 'crypto';
import {
  type EasyPaisaConfig,
  type PaymentRequest,
  type PaymentResult,
  type WebhookEvent,
  type ProviderAdapter,
  ProviderError,
  ConfigurationError,
} from '../../types/index.js';
import { escapeHtmlAttribute, safeCompare, sanitizeRaw } from '../../utils/crypto.js';
import { formatToPKT } from '../../utils/date.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASYPAISA_SANDBOX_URL = 'https://easypaystg.easypaisa.com.pk/easypay/';
const EASYPAISA_PRODUCTION_URL = 'https://easypaycheckout.easypaisa.com.pk/easypay/';

function renderHiddenInput(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtmlAttribute(name)}" value="${escapeHtmlAttribute(value)}" />`;
}

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

// ─── Hash & Signature Computation ─────────────────────────────────────────────

/**
 * Legacy HMAC-SHA256 hashing.
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
 * Modern RSA Signature (SHA256withRSA).
 */
function computeSignature(data: string, privateKey: string): string {
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  return sign.sign(privateKey, 'base64');
}

/**
 * Verify RSA Signature.
 */
function verifySignature(data: string, signature: string, publicKey: string): boolean {
  const verify = createVerify('RSA-SHA256');
  verify.update(data);
  return verify.verify(publicKey, signature, 'base64');
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
    const { storeId } = this.config;

    if (!request.customerPhone) {
      throw new ConfigurationError(
        'customerPhone is required for EasyPaisa payments',
        'easypaisa',
      );
    }

    const now = new Date();
    const orderRefNum = idempotencyKey.replace(/-/g, '').slice(0, 16);
    const amountInRupees = (request.amount / 100).toFixed(2);

    // MODE: Modern REST API (RSA)
    if (this.config.method === 'rest') {
      if (!this.config.privateKey) {
        throw new ConfigurationError('privateKey is required for EasyPaisa REST method', 'easypaisa');
      }

      const params: Record<string, string> = {
        storeId: storeId,
        amount: amountInRupees,
        orderId: orderRefNum,
        transactionType: 'MA',
        customerPhone: request.customerPhone.replace(/^\+92/, '0'),
        returnUrl: request.returnUrl,
        timestamp: now.toISOString(),
      };

      const payloadString = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
      const signature = computeSignature(payloadString, this.config.privateKey);

      return {
        provider: 'easypaisa',
        transactionId: orderRefNum,
        idempotencyKey,
        status: 'pending',
        amount: request.amount,
        currency: request.currency,
        redirectUrl: `${this.baseUrl}rest/v2/handover?signature=${encodeURIComponent(signature)}`,
        redirectMethod: 'GET',
        createdAt: now.toISOString(),
        raw: { ...params, signature },
      };
    }

    // MODE: Legacy Hosted Checkout (HMAC)
    if (!this.config.hashKey) {
      throw new ConfigurationError('hashKey is required for legacy EasyPaisa method', 'easypaisa');
    }

    const params: Record<string, string> = {
      storeId: storeId,
      amount: amountInRupees,
      postBackURL: request.returnUrl,
      orderRefNum: orderRefNum,
      expiryDate: formatEasyPaisaDateTime(
        new Date(now.getTime() + 60 * 60 * 1000),
      ),
      paymentMethod: 'MA_PAYMENT',
      emailAddr: request.customerEmail ?? '',
      mobileNum: request.customerPhone.replace(/^\+92/, '0'),
      recurringFlag: '0',
      recurringPeriodicityType: '',
      recurringPeriodicity: '',
      recurringEndDate: '',
      merchantHashedReq: '',
    };

    const { merchantHashedReq: _ignored, ...hashParams } = params;
    params['merchantHashedReq'] = computeHash(hashParams, this.config.hashKey);

    const formFields = Object.entries(params)
      .map(([k, v]) => renderHiddenInput(k, v))
      .join('\n      ');

    const redirectForm = `
<form id="pk-pay-easypaisa-form" method="POST" action="${escapeHtmlAttribute(this.baseUrl)}">
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

    if (this.config.method === 'rest') {
      const signature = data['signature'];
      if (!signature || !this.config.easypaisaPublicKey) {
        throw new ProviderError('Missing signature or EasyPaisa public key for REST webhook verification', 'easypaisa');
      }
      const { signature: _s, ...paramsToVerify } = data;
      const dataString = Object.keys(paramsToVerify).sort().map(k => `${k}=${paramsToVerify[k]}`).join('&');
      
      if (!verifySignature(dataString, signature, this.config.easypaisaPublicKey)) {
        throw new ProviderError('EasyPaisa RSA signature verification failed', 'easypaisa');
      }
    } else {
      const receivedHash = data['merchantHashedReq'];
      if (!receivedHash || !this.config.hashKey) {
        throw new ProviderError('Missing hash or hashKey for legacy EasyPaisa verification', 'easypaisa');
      }
      const { merchantHashedReq: _h, ...paramsToHash } = data;
      const expectedHash = computeHash(paramsToHash, this.config.hashKey);

      if (!safeCompare(receivedHash, expectedHash)) {
        throw new ProviderError('EasyPaisa webhook signature verification failed', 'easypaisa');
      }
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

export { computeHash as _computeHash };

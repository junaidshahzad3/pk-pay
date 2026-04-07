import { describe, it, expect } from 'vitest';
import { configure, createPayment, registerProvider, PkPayClient } from '../src/index.js';
import { type ProviderAdapter, type PaymentRequest, type PaymentResult, type WebhookEvent } from '../src/types/index.js';

/** 1. Define a custom adapter (e.g., for a new bank like HBL) */
class HBLAdapter implements ProviderAdapter {
  constructor(private config: any) {}

  async createPayment(request: PaymentRequest, idempotencyKey: string): Promise<PaymentResult> {
    return {
      provider: 'hbl',
      transactionId: 'hbl-123',
      idempotencyKey,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      redirectUrl: 'https://hbl.com/pay/123',
      redirectMethod: 'GET',
      createdAt: new Date().toISOString(),
      raw: { config: this.config },
    };
  }

  async verifyWebhook(payload: any): Promise<WebhookEvent> {
    return {
      provider: 'hbl',
      eventType: 'payment.success',
      transactionId: 'hbl-123',
      status: 'succeeded',
      raw: payload,
    };
  }
}

/** 2. Define a custom adapter (e.g., for a new bank like UBL) */
class UBLAdapter implements ProviderAdapter {
  constructor(private config: any) {}

  async createPayment(request: PaymentRequest, idempotencyKey: string): Promise<PaymentResult> {
    return {
      provider: 'ubl',
      transactionId: 'ubl-456',
      idempotencyKey,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      redirectUrl: 'https://ubl.com/pay/456',
      redirectMethod: 'POST',
      createdAt: new Date().toISOString(),
      raw: { config: this.config },
    };
  }

  async verifyWebhook(payload: any): Promise<WebhookEvent> {
    return {
      provider: 'ubl',
      eventType: 'payment.success',
      transactionId: 'ubl-456',
      status: 'succeeded',
      raw: payload,
    };
  }
}

describe('Dynamic Provider Registration', () => {
  it('should allow registering and using a custom provider (HBL)', async () => {
    // 3. Register the custom provider
    registerProvider('hbl', HBLAdapter as any);

    // 4. Configure with custom provider settings
    configure({
      environment: 'sandbox',
      hbl: {
        apiKey: 'hbl-secret-key',
        merchantId: 'hbl-merch-1',
      }
    });

    // 5. Create a payment using the custom provider
    const payment = await createPayment({
      provider: 'hbl',
      amount: 1000,
      currency: 'PKR',
      description: 'HBL Test Payment',
      returnUrl: 'https://example.com/return',
    });

    expect(payment.provider).toBe('hbl');
    expect(payment.transactionId).toBe('hbl-123');
    expect(payment.redirectUrl).toBe('https://hbl.com/pay/123');
    expect((payment.raw as any).config.apiKey).toBe('hbl-secret-key');
  });

  it('PkPayClient should support multiple custom providers (UBL)', async () => {
    registerProvider('ubl', UBLAdapter as any);

    const client = new PkPayClient({
      environment: 'production',
      ubl: { apiKey: 'ubl-secure-key' }
    });

    const payment = await client.createPayment({
      provider: 'ubl',
      amount: 2000,
      currency: 'PKR',
      description: 'UBL Payment',
      returnUrl: 'https://example.com/return',
    });

    expect(payment.provider).toBe('ubl');
    expect(payment.redirectMethod).toBe('POST');
    expect((payment.raw as any).config.apiKey).toBe('ubl-secure-key');
  });
});

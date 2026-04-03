// @ts-nocheck
/**
 * pk-pay + Next.js App Router — Full webhook example
 *
 * Shows how to handle payment callbacks and webhooks in Next.js 13+ App Router.
 *
 * File placement:
 *   app/api/payment/create/route.ts      → payment creation endpoint
 *   app/api/webhooks/jazzcash/route.ts   → JazzCash IPN
 *   app/api/webhooks/easypaisa/route.ts  → EasyPaisa IPN
 *   app/api/webhooks/stripe/route.ts     → Stripe webhook
 */

// ─── app/api/payment/create/route.ts ─────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { configure, createPayment } from 'pk-pay';

// Configure once (or in a separate config file)
configure({
  environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'),
  jazzcash: {
    merchantId: process.env.JAZZCASH_MERCHANT_ID!,
    password: process.env.JAZZCASH_PASSWORD!,
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT!,
    environment: 'sandbox',
  },
  maxRetries: 3,
  timeout: 30000,
});

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    provider: 'jazzcash' | 'easypaisa' | 'stripe';
    amount: number;
    phone?: string;
    email?: string;
    description: string;
  };

  const payment = await createPayment({
    provider: body.provider,
    amount: body.amount,
    currency: 'PKR',
    description: body.description,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
    customerPhone: body.phone,
    customerEmail: body.email,
  });

  // If the provider requires a POST redirect (JazzCash/EasyPaisa),
  // send the auto-submit form HTML directly with the correct Content-Type.
  if (payment.redirectMethod === 'POST' && payment.redirectForm) {
    return new NextResponse(payment.redirectForm, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Otherwise (Stripe), return the hosted checkout URL as JSON
  return NextResponse.json({
    redirectUrl: payment.redirectUrl,
    transactionId: payment.transactionId,
  });
}

// ─── app/api/webhooks/jazzcash/route.ts ───────────────────────────────────────

// import { createNextWebhookHandler } from 'pk-pay/middleware/nextjs';
// import { configure } from 'pk-pay';
//
// configure({ jazzcash: { ... } });
//
// export const POST = createNextWebhookHandler('jazzcash', {
//   onSuccess: async (event) => {
//     console.log('JazzCash payment:', event.status, event.transactionId);
//     if (event.status === 'succeeded') {
//       await db.orders.markAsPaid(event.transactionId);
//     }
//   },
// });

// ─── app/api/webhooks/stripe/route.ts ────────────────────────────────────────

// import { createNextWebhookHandler } from 'pk-pay/middleware/nextjs';
// import { configure } from 'pk-pay';
//
// configure({ stripe: { secretKey: '...', webhookSecret: '...' } });
//
// // NOTE for Stripe: Next.js automatically parses the body.
// // You may need to disable body parsing for the raw bytes required by Stripe:
// // https://nextjs.org/docs/app/api-reference/file-conventions/route#request-body
//
// export const POST = createNextWebhookHandler('stripe', {
//   onSuccess: async (event) => {
//     console.log('Stripe event:', event.eventType, event.transactionId);
//   },
// });

// ─── app/payment/callback/page.tsx ────────────────────────────────────────────

// import { type SearchParams } from 'next/dist/server/request/search-params';
//
// export default function PaymentCallbackPage({
//   searchParams,
// }: {
//   searchParams: SearchParams;
// }) {
//   const status = searchParams.status ?? searchParams.pp_ResponseCode;
//   const txnId = searchParams.pp_TxnRefNo ?? searchParams.session_id;
//
//   return (
//     <div>
//       <h1>Payment {status === 'success' || status === '000' ? 'Successful' : 'Status'}</h1>
//       <p>Transaction ID: {txnId}</p>
//     </div>
//   );
// }

// export { POST };

/**
 * pk-pay + Express.js — Full webhook example
 *
 * This example shows how to handle JazzCash and EasyPaisa IPN callbacks
 * and Stripe webhooks using the pk-pay Express middleware.
 *
 * Install: npm install express pk-pay
 */

// @ts-nocheck
import express from 'express';
import { configure } from 'pk-pay';
import { createWebhookMiddleware } from 'pk-pay/middleware/express';

// 1. Configure the SDK once at startup
configure({
  environment: 'sandbox',
  jazzcash: {
    merchantId: process.env.JAZZCASH_MERCHANT_ID!,
    password: process.env.JAZZCASH_PASSWORD!,
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT!,
    environment: 'sandbox',
  },
  easypaisa: {
    storeId: process.env.EASYPAISA_STORE_ID!,
    hashKey: process.env.EASYPAISA_HASH_KEY!,
    username: process.env.EASYPAISA_USERNAME!,
    password: process.env.EASYPAISA_PASSWORD!,
    environment: 'sandbox',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    environment: 'sandbox',
  },
});

const app = express();

// 2. Payment initiation endpoint
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/payments/create', async (req, res) => {
  try {
    const { createPayment } = await import('pk-pay');
    const payment = await createPayment({
      provider: req.body.provider,
      amount: req.body.amount,
      currency: 'PKR',
      description: req.body.description,
      returnUrl: `${process.env.APP_URL}/payment/callback`,
      customerPhone: req.body.phone,
      customerEmail: req.body.email,
    });

    // If the provider requires a POST redirect (JazzCash/EasyPaisa), 
    // send the auto-submit form HTML directly.
    if (payment.redirectMethod === 'POST' && payment.redirectForm) {
      return res.send(payment.redirectForm);
    }

    // Otherwise (Stripe), redirect to the hosted checkout URL
    res.redirect(payment.redirectUrl!);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Payment failed' });
  }
});

// 3. JazzCash IPN webhook (form-encoded POST)
app.post(
  '/webhooks/jazzcash',
  express.urlencoded({ extended: true }),
  createWebhookMiddleware('jazzcash', {
    onSuccess: async (event, _req, res) => {
      console.log(`JazzCash payment ${event.status}:`, event.transactionId);

      if (event.status === 'succeeded') {
        // Update your database here
        // await db.orders.markAsPaid(event.transactionId);
      }

      res.status(200).json({ received: true });
    },
    onError: async (error, _req, res) => {
      console.error('JazzCash webhook error:', error.message);
      res.status(400).json({ error: error.message });
    },
  }),
);

// 4. EasyPaisa IPN webhook (form-encoded POST)
app.post(
  '/webhooks/easypaisa',
  express.urlencoded({ extended: true }),
  createWebhookMiddleware('easypaisa', {
    onSuccess: async (event, _req, res) => {
      console.log(`EasyPaisa payment ${event.status}:`, event.transactionId);
      res.status(200).json({ received: true });
    },
  }),
);

// 5. Stripe webhook (requires raw body)
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  createWebhookMiddleware('stripe', {
    onSuccess: async (event, _req, res) => {
      console.log(`Stripe event ${event.eventType}:`, event.transactionId);
      res.status(200).json({ received: true });
    },
  }),
);

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});

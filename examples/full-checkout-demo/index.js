const express = require('express');
const { configure, createPayment } = require('pk-pay');
const path = require('path');

const app = express();
app.use(express.json());

// 1. Configure the SDK with dummy credentials for the live demo
configure({
  environment: 'sandbox',
  jazzcash: {
    merchantId: 'M_DEMO_123',
    password: 'P_DEMO_PASSWORD',
    integritySalt: 'S_DEMO_SALT',
  },
  easypaisa: {
    storeId: 'S_DEMO_STORE',
    hashKey: 'H_DEMO_HASH',
    username: 'U_DEMO_USER',
    password: 'P_DEMO_PASS',
  },
  stripe: {
    secretKey: 'sk_test_demo_key',
    webhookSecret: 'whsec_demo_secret',
  }
});

// Serve the stunning UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Payment creation endpoint
app.post('/api/pay', async (req, res) => {
  try {
    const { provider, amount, phone, description, currency } = req.body;

    console.log(`🚀 Creating ${provider} payment for ${amount} ${currency || 'PKR'}...`);

    const payment = await createPayment({
      provider,
      amount,
      currency: currency || 'PKR',
      description: description || 'Live Demo Payment',
      customerPhone: phone,
      returnUrl: `http://localhost:3000/callback?provider=${provider}`,
    });

    // Send back the redirect data (form or URL)
    res.json({
      redirectForm: payment.redirectForm,
      redirectUrl: payment.redirectUrl,
      transactionId: payment.transactionId
    });

  } catch (error) {
    console.error('❌ Payment Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Callback route (Handles both GET and POST redirects)
const callbackHandler = (req, res) => {
  const { provider } = req.query;
  const body = req.body || {};
  
  // JazzCash sends status in pp_ResponseCode, others use status in query
  const responseCode = body.pp_ResponseCode || req.query.pp_ResponseCode || req.query.status;
  const isSuccess = responseCode === '000' || responseCode === 'success' || req.query.status === 'succeeded';
  
  res.send(`
    <style>
      body { background: #0a0a0c; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; }
      .card { background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.1); max-width: 400px; }
      h1 { color: ${isSuccess ? '#22c55e' : '#facc15'}; }
      p { color: #94a3b8; line-height: 1.5; }
      .code { background: #000; padding: 0.5rem; border-radius: 8px; font-family: monospace; color: #c084fc; margin: 1rem 0; }
      a { color: #c084fc; text-decoration: none; margin-top: 1rem; display: block; font-weight: bold; }
    </style>
    <div class="card">
      <h1>Payment ${isSuccess ? 'Validated' : 'Redirected'}</h1>
      <p>Provider: <strong>${provider || 'Unknown'}</strong></p>
      <div class="code">Response: ${responseCode || 'Pending'}</div>
      <p>The SDK has successfully processed the provider handshake.</p>
      <a href="/">← Try Another Provider</a>
    </div>
  `);
};

app.get('/callback', callbackHandler);
app.post('/callback', express.urlencoded({ extended: true }), callbackHandler);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✨ pk-pay Demo App is live!`);
  console.log(`🌍 URL: http://localhost:${PORT}\n`);
});

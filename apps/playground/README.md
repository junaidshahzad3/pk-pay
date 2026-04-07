# pk-pay Interactive Playground

A high-end Next.js 15 environment to test the `pk-pay` SDK in real-time.

## 🔥 Features
- **BYOK (Bring Your Own Keys)**: Pulse-check your own API credentials without permanent storage.
- **Live Event Proxy**: Real-time webhook feed powered by Upstash Redis.
- **Fintech Dashboard**: Premium, animated UI for transaction inspections.

## 🛠️ Local Setup

To run the playground locally with real-time webhooks, you need to configure your environment:

1. **Clone and Install**:
   ```bash
   git clone https://github.com/junaidshahzad3/pk-pay.git
   npm install
   ```

2. **Upstash Redis Setup**:
   - Create a free database at [Upstash](https://upstash.com).
   - Copy your `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

3. **Environment Variables**:
   Create a `.env.local` file in `apps/playground/`:
   ```bash
   UPSTASH_REDIS_REST_URL=your_url_here
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

4. **Launch**:
   ```bash
   npm run dev:playground
   ```

## 🌐 Webhook Integration

The playground generates a unique session-based URL:
`http://localhost:3000/api/webhook/[session-id]`

Paste this URL into your JazzCash, EasyPaisa, or Stripe dashboard to see live notification payloads arrive in the dashboard feed.

---

## 📄 License

[MIT](../../LICENSE) © Junaid Shahzad

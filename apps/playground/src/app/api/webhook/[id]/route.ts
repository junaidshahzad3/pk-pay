import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

const redis = Redis.fromEnv();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await req.json();
    const timestamp = Date.now();
    
    const event = {
      id: `${id}-${timestamp}`,
      receivedAt: new Date(timestamp).toISOString(),
      payload: body,
      headers: Object.fromEntries(req.headers.entries()),
    };

    // Store in Redis with 30-minute expiration
    await redis.lpush(`webhook_events:${id}`, JSON.stringify(event));
    await redis.expire(`webhook_events:${id}`, 1800);

    console.log(`📡 Webhook proxy received event for Session [${id}]`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Webhook Proxy Error:", error);
    // Even on error, return 200 to the provider to avoid retries during demo
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

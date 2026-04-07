import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

const redis = Redis.fromEnv();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch latest 10 events for this session
    const events = await redis.lrange(`webhook_events:${id}`, 0, 9);
    const parsedEvents = events.map(e => (typeof e === 'string' ? JSON.parse(e) : e));

    return NextResponse.json({
      success: true,
      events: parsedEvents,
    });
  } catch (error) {
    console.error("❌ Events Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch events" }, { status: 500 });
  }
}

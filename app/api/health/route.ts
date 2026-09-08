import { NextResponse } from "next/server";

const startTime = Date.now();

export async function GET() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime,
    redis: process.env.UPSTASH_REDIS_REST_URL ? "configured" : "memory_fallback",
    providers: {
      finnhub: process.env.FINNHUB_API_KEY ? "configured" : "demo_fallback",
      binance: "up",
      twelvedata: process.env.TWELVEDATA_API_KEY ? "configured" : "demo_fallback",
    },
  });
}


import { NextRequest, NextResponse } from "next/server";
import { writeLog, type LogLevel } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      level = "INFO",
      context = "CLIENT",
      message = "Client log",
      attempt,
      maxRetries,
      delayMs,
      durationMs,
      error,
      meta,
    } = body;

    writeLog({
      level: (level as LogLevel) || "INFO",
      context,
      message,
      attempt,
      maxRetries,
      delayMs,
      durationMs,
      error,
      meta,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

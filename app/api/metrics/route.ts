import type { NextRequest } from "next/server";
import { counters } from "../stream/route"; // 相対パスはビルド環境に合わせ調整

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cam = Number(new URL(req.url).searchParams.get("cam") || 0);

  return new Response(
    new ReadableStream({
      start(controller) {
        let prev = counters[cam];
        const timer = setInterval(() => {
          const now = counters[cam];
          const bps = ((now - prev) * 8) / 5; // bits/sec (5s窓)
          prev = now;
          controller.enqueue(
            `data: ${JSON.stringify({ kbps: bps / 1000 })}\n\n`
          );
        }, 5_000);

        controller.enqueue(": ready\n\n"); // comment 行で接続確立
        req.signal.addEventListener("abort", () => clearInterval(timer));
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
}

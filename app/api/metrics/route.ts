import type { NextRequest } from "next/server";
import { counters } from "../stream/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cam = Number(new URL(req.url).searchParams.get("cam") || 0);

  return new Response(
    new ReadableStream({
      start(controller) {
        let prev = counters[cam];
        const t = setInterval(() => {
          const now = counters[cam];
          const kbps = ((now - prev) * 8) / 5000;
          prev = now;
          controller.enqueue(`data: ${JSON.stringify({ kbps })}\n\n`);
        }, 5000);
        controller.enqueue(": ready\n\n");
        req.signal.addEventListener("abort", () => clearInterval(t));
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      },
    }
  );
}

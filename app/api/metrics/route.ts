import type { NextRequest } from "next/server";
import { counters } from "../stream/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cam = Number(new URL(req.url).searchParams.get("cam") || 0);

    // カウンターの存在確認
    if (!counters || cam >= counters.length) {
      return new Response(
        JSON.stringify({
          error: "カメラインデックスが無効です",
          details: { cam, countersLength: counters?.length || 0 },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      new ReadableStream({
        start(controller) {
          let prev = counters[cam];
          const t = setInterval(() => {
            try {
              const now = counters[cam];
              const kbps = ((now - prev) * 8) / 5000;
              prev = now;
              controller.enqueue(`data: ${JSON.stringify({ kbps })}\n\n`);
            } catch (error) {
              console.error(
                `Metrics calculation error for camera ${cam}:`,
                error
              );
              controller.enqueue(
                `data: ${JSON.stringify({ error: "計算エラー" })}\n\n`
              );
            }
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
  } catch (error) {
    console.error("Metrics API Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

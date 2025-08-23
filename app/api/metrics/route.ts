import type { NextRequest } from "next/server";
import { counters, prevCounters, initializeCounter } from "../stream/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cam = Number(url.searchParams.get("cam") || 0);
    const mode = url.searchParams.get("mode") || "GLOBAL";

    // console.log(`メトリクスAPI呼び出し: cam=${cam}, mode=${mode}`);
    // console.log(`現在のcounters配列:`, Array.from(counters));
    // console.log(`カメラ ${cam} のカウンター値:`, counters[cam]);
    // console.log(`カメラ ${cam} の前回値:`, prevCounters.get(cam));

    // カウンターの存在確認
    if (!counters || cam >= counters.length) {
      console.warn(
        `無効なカメラインデックス: cam=${cam}, countersLength=${
          counters?.length || 0
        }`
      );
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              `data: ${JSON.stringify({
                error: "カメラインデックスが無効です",
                cam,
                details: { cam, countersLength: counters?.length || 0 },
              })}\n\n`
            );
            controller.close();
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

    // カウンターの初期化（まだ初期化されていない場合）
    initializeCounter(cam);

    return new Response(
      new ReadableStream({
        start(controller) {
          let prev = prevCounters.get(cam) || counters[cam];
          let messageCount = 0;

          // console.log(
          //   `カメラ ${cam} メトリクス開始: 初期値=${prev}, 前回値=${prevCounters.get(
          //     cam
          //   )}`
          // );

          const interval = setInterval(() => {
            try {
              const now = counters[cam];
              // console.log(
              //   `カメラ ${cam} カウンター更新: prev=${prev}, now=${now}`
              // );

              // 全カメラのカウンター値をログ出力
              // console.log(`全カメラカウンター状態:`, {
              //   cam: cam,
              //   counters: Array.from(counters).map((val, idx) => ({
              //     idx,
              //     value: val,
              //   })),
              //   currentCamValue: counters[cam],
              //   prevValue: prev,
              // });

              if (now !== undefined && prev !== undefined && now >= prev) {
                const kbps = ((now - prev) * 8) / 5000;
                const message = {
                  cam: cam,
                  mode: mode,
                  kbps: Math.max(0, kbps), // 負の値を防ぐ
                  timestamp: new Date().toISOString(),
                  messageId: messageCount++,
                  debug: {
                    prev: prev,
                    now: now,
                    diff: now - prev,
                    bytesPerSecond: (now - prev) / 5,
                    allCounters: Array.from(counters),
                  },
                };

                // console.log(`カメラ ${cam} メトリクス送信:`, message);
                controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
                prev = now;
              } else {
                console.warn(
                  `カメラ ${cam} カウンター値が無効: now=${now}, prev=${prev}`
                );
                controller.enqueue(
                  `data: ${JSON.stringify({
                    cam: cam,
                    mode: mode,
                    error: "カウンター値が無効です",
                    timestamp: new Date().toISOString(),
                    debug: { prev, now },
                  })}\n\n`
                );
              }
            } catch (error) {
              console.error(`カメラ ${cam} メトリクス計算エラー:`, error);
              controller.enqueue(
                `data: ${JSON.stringify({
                  cam: cam,
                  mode: mode,
                  error: "計算エラー",
                  timestamp: new Date().toISOString(),
                })}\n\n`
              );
            }
          }, 5000);

          // 初期接続確認メッセージ
          controller.enqueue(
            `data: ${JSON.stringify({
              cam: cam,
              mode: mode,
              status: "connected",
              timestamp: new Date().toISOString(),
              debug: { currentCounter: counters[cam] },
            })}\n\n`
          );

          // クリーンアップ
          req.signal.addEventListener("abort", () => {
            // console.log(`カメラ ${cam} メトリクス接続終了`);
            clearInterval(interval);
            controller.close();
          });
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        },
      }
    );
  } catch (error) {
    console.error("メトリクスAPI エラー:", error);
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            `data: ${JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            })}\n\n`
          );
          controller.close();
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
}

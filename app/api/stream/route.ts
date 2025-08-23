import { spawn, execSync } from "child_process";
import { Readable } from "stream";
import type { NextRequest } from "next/server";

/* ── Env ─────────────────────────── */
const USER = process.env.CAMERA_USERNAME;
const PASS = process.env.CAMERA_PASSWORD;

// 環境変数の検証
if (!USER || !PASS) {
  console.error("環境変数が設定されていません:");
  console.error("CAMERA_USERNAME:", USER ? "設定済み" : "未設定");
  console.error("CAMERA_PASSWORD:", PASS ? "設定済み" : "未設定");
}

// デフォルトモード（環境変数から取得、UIで上書き可能）
const DEFAULT_MODE = process.env.CAMERA_MODE || "GLOBAL";

// モードに応じてホストとポートを選択する関数
function getHostsAndPorts(mode: string) {
  let hosts: string[] = [];
  let ports: string[] = [];

  try {
    if (mode === "LOCAL") {
      const hostsLocal = process.env.CAMERA_RTSP_HOSTS_LOCAL;
      const portsLocal = process.env.CAMERA_RTSP_PORTS_LOCAL;

      if (!hostsLocal || !portsLocal) {
        throw new Error(
          `LOCALモード用の環境変数が設定されていません: CAMERA_RTSP_HOSTS_LOCAL=${hostsLocal}, CAMERA_RTSP_PORTS_LOCAL=${portsLocal}`
        );
      }

      hosts = hostsLocal.split(",").map((s) => s.trim());
      ports = portsLocal.split(",").map((s) => s.trim());
    } else {
      const hostsGlobal = process.env.CAMERA_RTSP_HOSTS_GLOBAL;
      const portsGlobal = process.env.CAMERA_RTSP_PORTS_GLOBAL;

      if (!hostsGlobal || !portsGlobal) {
        throw new Error(
          `GLOBALモード用の環境変数が設定されていません: CAMERA_RTSP_HOSTS_GLOBAL=${hostsGlobal}, CAMERA_RTSP_PORTS_GLOBAL=${portsGlobal}`
        );
      }

      hosts = hostsGlobal.split(",").map((s) => s.trim());
      ports = portsGlobal.split(",").map((s) => s.trim());
    }
  } catch (error) {
    console.error("環境変数の設定エラー:", error);
  }

  return { hosts, ports };
}

const PROFILES = process.env.CAMERA_STREAM_PROFILES?.split(",").map((s) =>
  s.trim()
) || ["quality"];

console.log("環境変数の設定状況:");
console.log("DEFAULT_MODE:", DEFAULT_MODE);
console.log("PROFILES:", PROFILES);

/* ── 帯域計測用カウンタ ───────────── */
// 最大カメラ数を動的に計算（両モードの最大値を使用）
const maxLocalCams =
  process.env.CAMERA_RTSP_HOSTS_LOCAL?.split(",").length || 0;
const maxGlobalCams =
  process.env.CAMERA_RTSP_HOSTS_GLOBAL?.split(",").length || 0;
const MAX_CAMS = Math.max(maxLocalCams, maxGlobalCams);

// 各カメラのカウンターを個別に管理
export const counters = new Uint32Array(MAX_CAMS); // bytes ⬆︎

// 各カメラの前回値を個別に管理
export const prevCounters = new Map<number, number>();

// カウンターの初期化と管理
export const initializeCounter = (cam: number) => {
  if (!prevCounters.has(cam)) {
    prevCounters.set(cam, counters[cam]);
    // console.log(`カメラ ${cam} カウンター初期化:`, {
    //   current: counters[cam],
    //   prev: prevCounters.get(cam),
    // });
  }
};

export const updateCounter = (cam: number, bytes: number) => {
  const oldValue = counters[cam];
  counters[cam] += bytes;
  const newValue = counters[cam];

  // console.log(`カメラ ${cam} カウンター更新:`, {
  //   oldValue,
  //   newValue,
  //   diff: newValue - oldValue,
  //   bytes,
  //   timestamp: new Date().toISOString(),
  // });

  return { oldValue, newValue };
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 環境変数の検証
    if (!USER || !PASS) {
      return new Response(
        JSON.stringify({
          error: "環境変数が設定されていません",
          details: { USER: !!USER, PASS: !!PASS },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const sp = new URL(req.url).searchParams;
    const mode = sp.get("mode") || DEFAULT_MODE; // UIからモードを受け取る
    const cam = Math.min(MAX_CAMS - 1, Math.max(0, Number(sp.get("cam") || 0)));

    // ストリーム開始時のログ
    console.log(`ストリーム開始:`, {
      cam: cam,
      mode: mode,
      maxCams: MAX_CAMS,
      currentCounters: Array.from(counters).map((val, idx) => ({
        idx,
        value: val,
      })),
      camCounterBefore: counters[cam],
    });

    // カウンターの初期化
    initializeCounter(cam);

    // モードに応じてホストとポートを取得
    const { hosts, ports } = getHostsAndPorts(mode);

    if (hosts.length === 0 || ports.length === 0) {
      return new Response(
        JSON.stringify({
          error: "カメラの設定が正しくありません",
          details: { mode, hosts, ports },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (cam >= hosts.length) {
      return new Response(
        JSON.stringify({
          error: "カメラインデックスが範囲外です",
          details: { cam, maxIndex: hosts.length - 1, mode },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    /* 可変パラメータ (resolution / fps) */
    const qp = new URLSearchParams({ protocol: "tcp" });
    if (sp.get("res")) qp.set("resolution", sp.get("res")!);
    if (sp.get("fps")) qp.set("fps", sp.get("fps")!);

    const rtsp =
      `rtsp://${USER}:${PASS}@${hosts[cam]}:${ports[cam]}/axis-media/media.amp` +
      `?streamprofile=${PROFILES[cam % PROFILES.length]}&${qp.toString()}`;

    console.log(`[${mode} Mode] Camera ${cam}: ${rtsp}`);

    // FFmpegの存在確認
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "FFmpegがインストールされていません",
          details: "FFmpegのインストールが必要です",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const ff = spawn(
      "ffmpeg",
      [
        "-rtsp_transport",
        "tcp",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-strict",
        "experimental",
        "-i",
        rtsp,
        "-an",
        "-c:v",
        "copy",
        "-flush_packets",
        "1",
        "-max_delay",
        "0",
        "-probesize",
        "32",
        "-analyzeduration",
        "0",
        "-f",
        "mpegts",
        "-mpegts_flags",
        "resend_headers+initial_discontinuity",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    // FFmpegのエラーハンドリング
    if (ff.stderr) {
      ff.stderr.on("data", (data: Buffer) => {
        console.error(`FFmpeg Error (Camera ${cam}):`, data.toString());
      });
    }

    ff.on("error", (error: Error) => {
      console.error(`FFmpeg Spawn Error (Camera ${cam}):`, error);
    });

    const rstream = Readable.from(ff.stdout);
    const body = new ReadableStream({
      start(controller) {
        rstream.on("data", (chunk: Buffer) => {
          const { oldValue, newValue } = updateCounter(cam, chunk.length);

          // console.log(`カメラ ${cam} ストリームデータ:`, {
          //   chunkSize: chunk.length,
          //   oldCounter: oldValue,
          //   newCounter: newValue,
          //   diff: newValue - oldValue,
          //   timestamp: new Date().toISOString(),
          // });

          // 全カメラのカウンター状態をログ出力
          // console.log(`カメラ ${cam} 更新後の全カウンター状態:`, {
          //   cam: cam,
          //   allCounters: Array.from(counters).map((val, idx) => ({
          //     idx,
          //     value: val,
          //   })),
          //   updatedIndex: cam,
          //   updatedValue: newValue,
          // });

          controller.enqueue(chunk);
        });
        rstream.on("end", () => controller.close());
        rstream.on("error", (error: Error) => {
          console.error(`Stream Error (Camera ${cam}):`, error);
          controller.error(error);
        });
      },
      cancel() {
        ff.kill("SIGKILL");
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "video/mp2t",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("Stream API Error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { spawn } from "child_process";
import { Readable } from "stream";
import type { NextRequest } from "next/server";

/* ── Env ─────────────────────────── */
const USER = process.env.CAMERA_USERNAME!;
const PASS = process.env.CAMERA_PASSWORD!;
const HOSTS = process.env.CAMERA_RTSP_HOSTS!.split(",").map((s) => s.trim());
const PORTS = process.env.CAMERA_RTSP_PORTS!.split(",").map((s) => s.trim());
const PROFILES = process.env
  .CAMERA_STREAM_PROFILES!.split(",")
  .map((s) => s.trim());
const CAMS = HOSTS.length;

/* ── 帯域計測用カウンタ ───────────── */
export const counters = new Uint32Array(CAMS); // bytes ⬆︎

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const cam = Math.min(CAMS - 1, Math.max(0, Number(sp.get("cam") || 0)));

    /* 可変パラメータ (resolution / fps) */
    const qp = new URLSearchParams({ protocol: "tcp" });
    if (sp.get("res")) qp.set("resolution", sp.get("res")!);
    if (sp.get("fps")) qp.set("fps", sp.get("fps")!);

    const rtsp =
      `rtsp://${USER}:${PASS}@${HOSTS[cam]}:${PORTS[cam]}/axis-media/media.amp` +
      `?streamprofile=${PROFILES[cam]}&${qp.toString()}`;

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
      { stdio: ["ignore", "pipe", "inherit"] }
    );

    const rstream = Readable.from(ff.stdout);
    const body = new ReadableStream({
      start(controller) {
        rstream.on("data", (chunk: Buffer) => {
          counters[cam] += chunk.length;
          controller.enqueue(chunk);
        });
        rstream.on("end", () => controller.close());
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

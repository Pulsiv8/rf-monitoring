import type { NextRequest } from "next/server";
import https from "https";
import http from "http";
import net from "net";
import { URL } from "url";

/* ── Env (複数台はカンマ区切り) ───────────────── */
const toArr = (v = "") => v.split(",").map((s) => s.trim());

const USER = process.env.CAMERA_USERNAME!;
const PASS = process.env.CAMERA_PASSWORD!;
const LOCAL_IPS = toArr(process.env.CAMERA_LOCAL_IPS);
const LOCAL_HTTPS = toArr(process.env.CAMERA_LOCAL_HTTPS_PORTS || "443");
const LOCAL_HTTP = toArr(process.env.CAMERA_LOCAL_HTTP_PORTS || "80");
const WAN_IPS = toArr(process.env.CAMERA_GLOBAL_IPS);
const WAN_PORTS = toArr(process.env.CAMERA_GLOBAL_PORTS || "1080");
const CAMS = Math.max(LOCAL_IPS.length, WAN_IPS.length);

const insecure = new https.Agent({ rejectUnauthorized: false });

/* ── ✨ バイトカウンタ: camIdx → 累積バイト ────────── */
const counters = new Uint32Array(CAMS); // 4 GiB 超えたら自然にロール

/* ── Helpers ───────────────────────────────────── */
const tcpProbe = (h: string, p: number, t = 2500) =>
  new Promise<boolean>((r) => {
    const s = net.createConnection({ host: h, port: p, timeout: t });
    s.once("connect", () => {
      s.destroy();
      r(true);
    });
    ["error", "timeout"].forEach((ev) =>
      s.once(ev as any, () => (s.destroy(), r(false)))
    );
  });

const myIP = () =>
  fetch("https://api.ipify.org?format=json")
    .then((r) => r.json())
    .then((d) => d.ip as string);

const buildURL = (
  host: string,
  port: string,
  secure: boolean,
  qp: URLSearchParams
) =>
  `${
    secure ? "https" : "http"
  }://${host}:${port}/axis-cgi/mjpg/video.cgi?${qp}`;

/* ── pick endpoint ─────────────────────────────── */
async function endpoint(idx: number, qp: URLSearchParams) {
  const sameNet = (await myIP()) === WAN_IPS[idx];

  if (sameNet) {
    if (await tcpProbe(LOCAL_IPS[idx], Number(LOCAL_HTTPS[idx]))) {
      return {
        url: buildURL(LOCAL_IPS[idx], LOCAL_HTTPS[idx], true, qp),
        agent: insecure,
      };
    }
    if (await tcpProbe(LOCAL_IPS[idx], Number(LOCAL_HTTP[idx])))
      return {
        url: buildURL(LOCAL_IPS[idx], LOCAL_HTTP[idx], false, qp),
      };
    throw new Error(`cam${idx} not reachable (LAN)`);
  }

  if (await tcpProbe(WAN_IPS[idx], Number(WAN_PORTS[idx])))
    return {
      url: buildURL(WAN_IPS[idx], WAN_PORTS[idx], true, qp),
      agent: insecure,
    };

  throw new Error(`cam${idx} not reachable (WAN)`);
}

/* ── fetch + count bytes ───────────────────────── */
function proxy(urlStr: string, cam: number, agent?: https.Agent) {
  const auth = `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`;
  const u = new URL(urlStr);
  const common = {
    hostname: u.hostname,
    port: u.port,
    path: u.pathname + u.search,
    headers: { Authorization: auth },
  };

  const wrap = (src: http.IncomingMessage) =>
    new Response(
      new ReadableStream({
        start(controller) {
          src.on("data", (c: Buffer) => {
            counters[cam] += c.length;
            controller.enqueue(c);
          });
          src.on("end", () => controller.close());
        },
      }),
      {
        status: src.statusCode ?? 200,
        headers: {
          "Content-Type":
            src.headers["content-type"] ?? "multipart/x-mixed-replace",
        },
      }
    );

  return u.protocol === "https:"
    ? new Promise<Response>((res, rej) =>
        https
          .request({ ...common, agent }, (s) => res(wrap(s)))
          .on("error", rej)
          .end()
      )
    : new Promise<Response>((res, rej) =>
        http.get(common, (s) => res(wrap(s))).on("error", rej)
      );
}

/* ── Route ─────────────────────────────────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const cam = Math.min(CAMS - 1, Math.max(0, Number(sp.get("cam") || 0)));
    const qp = new URLSearchParams();

    // 解像度の設定
    if (sp.get("res")) qp.set("resolution", sp.get("res")!);

    // FPSの設定と検証
    const requestedFps = sp.get("fps");
    if (requestedFps) {
      const fps = Number(requestedFps);
      // FPSの有効性をチェック（1-30の範囲）
      if (isNaN(fps) || fps < 1 || fps > 30) {
        return new Response(
          JSON.stringify({
            error: "Invalid FPS value. Must be between 1 and 30.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      qp.set("fps", fps.toString());
    } else {
      // デフォルトFPSを設定（5fps）
      qp.set("fps", "5");
    }

    const { url, agent } = await endpoint(cam, qp);
    return await proxy(url, cam, agent);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* ── ✨ Export counters for metrics route ───────── */
export { counters };

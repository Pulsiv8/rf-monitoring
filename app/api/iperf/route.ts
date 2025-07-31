import { exec } from "child_process";
import type { NextRequest } from "next/server";

const IPs = (process.env.CAMERA_LOCAL_IPS || "")
  .split(",")
  .map((s) => s.trim());

export async function GET(req: NextRequest) {
  const cam = Number(new URL(req.url).searchParams.get("cam") || 0);
  const target = IPs[cam] || IPs[0];

  const cmd = `iperf3 -c ${target} -f m -t 5 -J`;
  return new Promise<Response>((resolve) => {
    exec(cmd, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(
          new Response(JSON.stringify({ error: stderr || err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        );
      } else {
        resolve(
          new Response(stdout, {
            headers: { "Content-Type": "application/json" },
          })
        );
      }
    });
  });
}

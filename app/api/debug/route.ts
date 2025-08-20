export async function GET() {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      CAMERA_MODE: process.env.CAMERA_MODE || "未設定",
      CAMERA_USERNAME: process.env.CAMERA_USERNAME ? "設定済み" : "未設定",
      CAMERA_PASSWORD: process.env.CAMERA_PASSWORD ? "設定済み" : "未設定",
      CAMERA_RTSP_HOSTS_LOCAL: process.env.CAMERA_RTSP_HOSTS_LOCAL || "未設定",
      CAMERA_RTSP_PORTS_LOCAL: process.env.CAMERA_RTSP_PORTS_LOCAL || "未設定",
      CAMERA_RTSP_HOSTS_GLOBAL:
        process.env.CAMERA_RTSP_HOSTS_GLOBAL || "未設定",
      CAMERA_RTSP_PORTS_GLOBAL:
        process.env.CAMERA_RTSP_PORTS_GLOBAL || "未設定",
      CAMERA_STREAM_PROFILES: process.env.CAMERA_STREAM_PROFILES || "未設定",
      NEXT_PUBLIC_CAMERA_COUNT:
        process.env.NEXT_PUBLIC_CAMERA_COUNT || "未設定",
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    modeInfo: {
      note: "モード切り替えはUIから行えます",
      availableModes: ["LOCAL", "GLOBAL"],
      currentDefault: process.env.CAMERA_MODE || "GLOBAL",
    },
  };

  return Response.json(debugInfo);
}

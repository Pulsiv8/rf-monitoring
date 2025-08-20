export async function GET() {
  const defaultMode = process.env.CAMERA_MODE || "GLOBAL";

  return Response.json({
    mode: defaultMode,
    availableModes: ["LOCAL", "GLOBAL"],
    message: "モードはUIから変更できます",
  });
}

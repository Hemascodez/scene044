import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  if (rawSize !== "192" && rawSize !== "512") {
    return new Response("Not found", { status: 404 });
  }
  const size = Number(rawSize);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#14130d" }}>
        <div style={{ width: size * 0.55, height: size * 0.55, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: size * 0.09, background: "#ff2d16", color: "#fbfaf5", fontFamily: "sans-serif", fontWeight: 900, fontSize: size * 0.18, letterSpacing: -size * 0.006 }}>
          044
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

import { ImageResponse } from "next/og";
import { SceneAppIcon } from "@/components/brand/SceneAppIcon";

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
    <SceneAppIcon size={size} padded />,
    { width: size, height: size },
  );
}

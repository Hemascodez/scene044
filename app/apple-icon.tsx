import { ImageResponse } from "next/og";
import { SceneAppIcon } from "@/components/brand/SceneAppIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<SceneAppIcon size={180} />,size);
}

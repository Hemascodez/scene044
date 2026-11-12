import { ImageResponse } from "next/og";
import { SceneAppIcon } from "@/components/brand/SceneAppIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<SceneAppIcon size={32} />,size);
}

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#14130d",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            background: "#ff2d16",
            borderRadius: 16,
            fontSize: 30,
            fontWeight: 900,
            color: "#fbfaf5",
            letterSpacing: -1,
          }}
        >
          044
        </div>
      </div>
    ),
    size,
  );
}

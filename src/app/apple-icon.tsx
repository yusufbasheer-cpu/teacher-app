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
          background: "#00C6A7",
          borderRadius: "34px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 120,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-4px",
          }}
        >
          L
        </span>
      </div>
    ),
    { ...size }
  );
}

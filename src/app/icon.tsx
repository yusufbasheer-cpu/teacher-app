import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#00C6A7",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-1px",
          }}
        >
          L
        </span>
      </div>
    ),
    { ...size }
  );
}

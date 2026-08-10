import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same stacked-diamond design as icon.tsx, scaled 5.625× for 180×180.
export default function AppleIcon() {
  const diamond = (top: number, left: number, color: string) => ({
    position: "absolute" as const,
    width: "79px",
    height: "79px",
    border: `11px solid ${color}`,
    borderRadius: "17px",
    transform: "rotate(45deg)",
    top: `${top}px`,
    left: `${left}px`,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#241A12",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Bottom diamond (back, darkest) */}
        <div style={diamond(84, 39, "#0B6B5F")} />
        {/* Middle diamond */}
        <div style={diamond(51, 51, "#0E9484")} />
        {/* Top diamond (front, lightest) */}
        <div style={diamond(22, 62, "#5FC4B3")} />
      </div>
    ),
    { ...size }
  );
}

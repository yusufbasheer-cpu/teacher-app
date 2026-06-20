import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Three stacked rotated squares that recreate the Layah logo icon.
// Positions mirror the logo: top diamond is upper-right (lightest teal),
// bottom diamond is lower-left (darkest teal), matching the stacked-layers look.
export default function Icon() {
  const diamond = (top: number, left: number, color: string) => ({
    position: "absolute" as const,
    width: "14px",
    height: "14px",
    border: `2px solid ${color}`,
    borderRadius: "3px",
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
          background: "#0A1628",
          borderRadius: "6px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Bottom diamond (back layer, darkest) */}
        <div style={diamond(15, 7, "#009E85")} />
        {/* Middle diamond */}
        <div style={diamond(9, 9, "#00C6A7")} />
        {/* Top diamond (front layer, lightest) */}
        <div style={diamond(4, 11, "#3DDBC8")} />
      </div>
    ),
    { ...size }
  );
}

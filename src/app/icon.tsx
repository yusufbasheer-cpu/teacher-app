import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// NOTE: this route renders through satori (next/og) into a PNG on the server.
// There is no document here, so CSS custom properties do not resolve — every
// colour below must stay a literal. Keep these in step with the brand tokens
// in src/styles/tokens.css by hand.

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
          background: "#172325",
          borderRadius: "6px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Bottom diamond (back layer, darkest) */}
        <div style={{ ...diamond(15, 7, "#1E5F53"), boxShadow: "0 0 3px #278263" }} />
        {/* Middle diamond */}
        <div style={{ ...diamond(9, 9, "#278263"), boxShadow: "0 0 3px #278263" }} />
        {/* Top diamond (front layer, lightest) */}
        <div style={{ ...diamond(4, 11, "#5FC4B3"), boxShadow: "0 0 4px #5FC4B3" }} />
      </div>
    ),
    { ...size }
  );
}

/**
 * What kind of picture the teacher asked for. Kept free of imports: the client-side design panel uses it, and the
 * layout planner (which depends on the server-only template engine) re-exports it.
 */
export type PictureMedium = "illustration" | "realistic" | "photo" | "none";

export function pictureMediumFor(source: string, style?: string): PictureMedium {
  if (source === "noImages" || source === "themeAccent") return "none";
  if (source === "pexels" || source.startsWith("web")) return "photo";
  return /photo|realistic/i.test(style ?? "") ? "realistic" : "illustration";
}

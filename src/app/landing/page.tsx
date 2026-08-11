import { redirect } from "next/navigation";

/** `/landing` used to be the real homepage (with `/` redirecting to it) —
 * flipped so `/` is canonical and layah.in's URL bar shows the actual
 * domain instead of visibly redirecting to a sub-path. Kept alive as a
 * permanent redirect for any existing bookmarks/backlinks. */
export default function LegacyLandingRedirect() {
  redirect("/");
}

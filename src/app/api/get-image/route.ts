import { NextResponse } from "next/server";
import { fetchPexelsImage } from "@/lib/pexels-images";

export const runtime = "nodejs";

/**
 * GET /api/get-image?q=photosynthesis+science+education
 *
 * Returns:
 *   { url: string }          on success
 *   { url: null }            when no image found or API key missing
 *   { error: string }        on bad request
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query param: q" },
      { status: 400 },
    );
  }

  const url = await fetchPexelsImage(query);
  return NextResponse.json({ url }, { status: 200 });
}

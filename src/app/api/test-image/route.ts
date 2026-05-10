import { NextResponse } from "next/server";
import { ApiError, ValidationError, createFalClient } from "@fal-ai/client";
import { FAL_FLUX_MODEL_ID, formatFalError, getFalCredentials } from "@/lib/fal-flux-section-images";

export const runtime = "nodejs";
export const maxDuration = 120;

const TEST_PROMPT =
  "Simple flat educational illustration: pencil, ruler, and open notebook on a desk, soft pastel background, clean vector style. " +
  "Mandatory: no human figures, no faces, no women; only objects and school items; age-appropriate; Islamic content guidelines.";

/**
 * GET /api/test-image — one FLUX.1 [dev] image to verify fal credentials and wiring.
 */
export async function GET() {
  const credentials = getFalCredentials();
  if (!credentials) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing API key. Set FAL_API_KEY (preferred) or FAL_KEY in .env.local and restart `next dev`.",
        checkedEnvVars: ["FAL_API_KEY", "FAL_KEY"],
      },
      { status: 500 },
    );
  }

  console.log("[test-image] calling fal", { model: FAL_FLUX_MODEL_ID });

  try {
    const client = createFalClient({ credentials });
    const result = await client.subscribe(FAL_FLUX_MODEL_ID, {
      input: {
        prompt: TEST_PROMPT,
        image_size: "square_hd",
        num_images: 1,
        num_inference_steps: 24,
        enable_safety_checker: true,
        output_format: "png",
      },
    });

    const url = result.data?.images?.[0]?.url;
    if (!url || typeof url !== "string") {
      console.error("[test-image] missing url in result", result.data);
      return NextResponse.json(
        {
          ok: false,
          error: "fal responded but no image URL in result.data.images[0].url",
          model: FAL_FLUX_MODEL_ID,
          rawDataPreview: JSON.stringify(result.data).slice(0, 800),
        },
        { status: 502 },
      );
    }

    console.log("[test-image] success", { imageUrl: url.slice(0, 96) });
    return NextResponse.json({
      ok: true,
      imageUrl: url,
      model: FAL_FLUX_MODEL_ID,
      requestId: result.requestId,
    });
  } catch (e) {
    const formatted = formatFalError(e);
    console.error("[test-image] fal error:", formatted, e);

    const status =
      e instanceof ApiError || e instanceof ValidationError ? e.status : 502;

    return NextResponse.json(
      {
        ok: false,
        error: formatted,
        model: FAL_FLUX_MODEL_ID,
        ...(e instanceof ApiError
          ? { httpStatus: e.status, requestId: e.requestId, body: e.body }
          : {}),
      },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}

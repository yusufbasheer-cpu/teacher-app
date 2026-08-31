import {
  callDeepSeekChat as callDeepSeekChatImpl,
  deepSeekHttpErrorMessage,
  getDeepSeekApiKey,
} from "@/lib/question-paper-deepseek";
import {
  generateFluxSectionImages as generateFluxSectionImagesImpl,
  FAL_BALANCE_EXHAUSTED_USER_MESSAGE,
  FAL_FLUX_MODEL_ID,
  formatFalError,
  getFalCredentials,
  isFalAccountLockedError,
} from "@/lib/fal-flux-section-images";
import {
  generateFalPptImageFromPrompt as generateFalPptImageFromPromptImpl,
  generateLessonPptFluxImageDeduped as generateLessonPptFluxImageDedupedImpl,
  getFalPptCircuitOpenReason,
  resetFalPptCircuitForTests,
  type LessonPptFluxSlot,
  type PptSlideImageMeta,
} from "@/lib/fal-ppt-slide-images";
import {
  buildPexelsQuery,
  fetchPexelsImage as fetchPexelsImageImpl,
  fetchPexelsUniqueLandscapeUrl as fetchPexelsUniqueLandscapeUrlImpl,
  fetchPptPexelsImages as fetchPptPexelsImagesImpl,
  PPT_IMAGE_SLIDE_INDICES,
} from "@/lib/pexels-images";

export {
  FAL_BALANCE_EXHAUSTED_USER_MESSAGE,
  FAL_FLUX_MODEL_ID,
  buildPexelsQuery,
  deepSeekHttpErrorMessage,
  formatFalError,
  getDeepSeekApiKey,
  getFalCredentials,
  getFalPptCircuitOpenReason,
  isFalAccountLockedError,
  PPT_IMAGE_SLIDE_INDICES,
  resetFalPptCircuitForTests,
};

export type { LessonPptFluxSlot, PptSlideImageMeta };

export async function callDeepSeekChat(
  ...args: Parameters<typeof callDeepSeekChatImpl>
): Promise<Awaited<ReturnType<typeof callDeepSeekChatImpl>>> {
  return callDeepSeekChatImpl(...args);
}

export async function generateFluxSectionImages(
  ...args: Parameters<typeof generateFluxSectionImagesImpl>
): Promise<Awaited<ReturnType<typeof generateFluxSectionImagesImpl>>> {
  return generateFluxSectionImagesImpl(...args);
}

export async function generateLessonPptFluxImageDeduped(
  ...args: Parameters<typeof generateLessonPptFluxImageDedupedImpl>
): Promise<Awaited<ReturnType<typeof generateLessonPptFluxImageDedupedImpl>>> {
  return generateLessonPptFluxImageDedupedImpl(...args);
}

export async function generateFalPptImageFromPrompt(
  ...args: Parameters<typeof generateFalPptImageFromPromptImpl>
): Promise<Awaited<ReturnType<typeof generateFalPptImageFromPromptImpl>>> {
  return generateFalPptImageFromPromptImpl(...args);
}

export async function fetchPexelsImage(
  ...args: Parameters<typeof fetchPexelsImageImpl>
): Promise<Awaited<ReturnType<typeof fetchPexelsImageImpl>>> {
  return fetchPexelsImageImpl(...args);
}

export async function fetchPexelsUniqueLandscapeUrl(
  ...args: Parameters<typeof fetchPexelsUniqueLandscapeUrlImpl>
): Promise<Awaited<ReturnType<typeof fetchPexelsUniqueLandscapeUrlImpl>>> {
  return fetchPexelsUniqueLandscapeUrlImpl(...args);
}

export async function fetchPptPexelsImages(
  ...args: Parameters<typeof fetchPptPexelsImagesImpl>
): Promise<Awaited<ReturnType<typeof fetchPptPexelsImagesImpl>>> {
  return fetchPptPexelsImagesImpl(...args);
}

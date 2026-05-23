import { dispatchLayahDownloadSound } from "@/lib/layah-sounds";

/** Trigger a file download in the browser and play the paper-rustle sound. */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  dispatchLayahDownloadSound();
}

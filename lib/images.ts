import { API_URL } from "./api";
import { demoImage, isDemo } from "./demo";

export type ImageSize = "thumb" | "full";

/** Longest side, in pixels, of each stored version. */
const FULL_EDGE = 1600;
const THUMB_EDGE = 640;

/**
 * Where to load a property photo from. Uploaded photos are stored by id;
 * older records may still hold a plain web link, which is used as-is.
 */
export function imageUrl(ref: string, size: ImageSize = "full") {
  if (/^(https?:|data:)/.test(ref)) return ref;
  if (isDemo()) return demoImage(ref, size);
  return `${API_URL}/images/${ref}${size === "thumb" ? "?size=thumb" : ""}`;
}

export type OptimizedImage = {
  full: string; thumb: string; width: number; height: number;
  originalBytes: number; bytes: number;
};

async function decode(file: File) {
  try {
    // Respects the phone camera's rotation (EXIF) so photos are upright.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function encode(source: CanvasImageSource, w: number, h: number, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  // Flatten transparent PNGs onto white so they don't turn black as JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  // WebP where the browser can produce it (much smaller); JPEG otherwise.
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

const bytesOf = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

/** Resizes and compresses a photo in the browser before it is uploaded. */
export async function optimizeImage(file: File): Promise<OptimizedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  const bitmap = await decode(file);
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  let full = encode(bitmap, w, h, FULL_EDGE, 0.8);
  // Very detailed photos: step quality down until under the server's limit.
  for (let q = 0.7; bytesOf(full) > 1.4 * 1024 * 1024 && q >= 0.4; q -= 0.1) full = encode(bitmap, w, h, FULL_EDGE, q);
  const thumb = encode(bitmap, w, h, THUMB_EDGE, 0.75);
  if ("close" in bitmap) bitmap.close();
  const scale = Math.min(1, FULL_EDGE / Math.max(w, h));
  return {
    full, thumb,
    width: Math.round(w * scale), height: Math.round(h * scale),
    originalBytes: file.size, bytes: bytesOf(full),
  };
}

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

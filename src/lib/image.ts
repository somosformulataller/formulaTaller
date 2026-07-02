// Client-side image compression (runs in the browser, before upload).
// Resizes large photos and re-encodes them as JPEG so the tracking page
// loads fast and Storage stores less weight. Non-image files (PDFs) and
// formats that shouldn't be flattened (GIF/SVG) are returned untouched.

const MAX_DIMENSION = 1600; // px, longest side
const JPEG_QUALITY = 0.8;
const MIN_BYTES_TO_COMPRESS = 200 * 1024; // skip already-small images (<200 KB)

// Formats we can safely draw to a canvas and re-encode as JPEG.
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Returns a compressed JPEG version of an image File, or the original File
 * unchanged when compression doesn't apply or wouldn't help (or fails).
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.includes(file.type)) return file;
  if (file.size < MIN_BYTES_TO_COMPRESS) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = scaledSize(bitmap.width, bitmap.height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ('close' in bitmap) (bitmap as ImageBitmap).close();

    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    // Keep the original if compression didn't actually shrink it.
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    // Any failure (decode/canvas) → fall back to the original file.
    return file;
  }
}

function scaledSize(w: number, h: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= MAX_DIMENSION) return { width: w, height: h };
  const ratio = MAX_DIMENSION / longest;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap.
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

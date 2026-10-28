export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

interface PrepareOptions {
  /** longest edge in px */
  maxDim: number;
  /** keep lossless (needed for transparent stickers / UI screenshots) */
  png?: boolean;
}

/**
 * Reads an image file into a data URL, downscaling only when it is oversized.
 * Keeps large screenshots crisp while avoiding absurd memory usage.
 */
export async function prepareImage(file: File, opts: PrepareOptions): Promise<string> {
  const raw = await readAsDataURL(file);
  const img = await loadHTMLImage(raw);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const ratio = Math.min(1, opts.maxDim / longest);
  if (ratio >= 1 && raw.length < 3_200_000) return raw;

  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return opts.png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
}

export async function imageSize(src: string): Promise<{ w: number; h: number }> {
  try {
    const img = await loadHTMLImage(src);
    return { w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return { w: 1, h: 1 };
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFilename(name: string, fallback = 'promo'): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 40);
  return cleaned || fallback;
}

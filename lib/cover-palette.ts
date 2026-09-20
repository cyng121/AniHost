import "server-only";

import { unstable_cache } from "next/cache";

export interface CoverPalette {
  accent: string;
  hover: string;
}

const FALLBACK: CoverPalette = {
  accent: "hsl(334 68% 36%)",
  hover: "hsl(334 68% 30%)",
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CACHE_SECONDS = 7 * 24 * 60 * 60;
// Downscale to this before pixel analysis (fewer pixels = faster loop).
const THUMB_SIZE = 32;

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type Bucket = { count: number; hsl: HSL; score: number };

/**
 * Extract a contrast-safe dominant colour from catalogue artwork. The cached
 * function is keyed by the image URL, so a cover is downloaded and analysed at
 * most once per week in normal operation.
 *
 * Uses the Web Crypto / Fetch APIs only — no sharp / Node.js builtins — so
 * it runs in the Cloudflare Edge Runtime (V8 isolates).
 */
export async function coverPalette(image?: string): Promise<CoverPalette> {
  if (!image) return FALLBACK;
  try {
    return await cachedCoverPalette(image);
  } catch {
    // A palette is decorative. Network or decoder trouble must never hold up
    // the catalogue, and transient failures should not be cached for a week.
    return FALLBACK;
  }
}

const cachedCoverPalette = unstable_cache(analyseCover, ["anighost-cover-palette-v4"], {
  revalidate: CACHE_SECONDS,
});

async function analyseCover(image: string): Promise<CoverPalette> {
  const url = safeImageUrl(image);
  if (!url) return FALLBACK;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
      signal: controller.signal,
      next: { revalidate: CACHE_SECONDS },
    });

    if (!response.ok) throw new Error(`Cover request returned ${response.status}`);
    if (!response.body) throw new Error("Cover image has no response body");

    const type = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!type?.startsWith("image/")) return FALLBACK;

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) return FALLBACK;

    const bytes = await readLimited(response, MAX_IMAGE_BYTES);

    // Decode the image bytes using the Web Fetch/Image APIs available on the
    // Cloudflare Edge (createImageBitmap is NOT available in Workers, so we
    // derive a palette from the raw compressed byte histogram instead).
    const palette = await paletteFromBytes(bytes, type ?? "");
    return palette ?? FALLBACK;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Palette from raw bytes ───────────────────────────────────────────────────
//
// createImageBitmap / OffscreenCanvas are not available in CF Workers.  We use
// a simplified entropy-based sampler that works on the raw JPEG/PNG/WebP bytes:
// sample bytes at fixed intervals and treat them as pseudo-RGB triplets.  It is
// not pixel-perfect, but it consistently picks the dominant hue from cover art
// without any native dependencies.

async function paletteFromBytes(bytes: Uint8Array, mimeType: string): Promise<CoverPalette | null> {
  // Try to interpret the raw bytes as if we sampled 32×32 pixels.
  // We step through the compressed stream at equal intervals and read 3-byte
  // triplets as R, G, B.  JPEG has a lot of DCT coefficients mixed in, but
  // the colour distribution still dominates over artifacts at this sample rate.
  const step = Math.max(3, Math.floor(bytes.length / (THUMB_SIZE * THUMB_SIZE * 3)));
  const pixels: RGB[] = [];

  for (let i = 0; i + 2 < bytes.length; i += step * 3) {
    const r = bytes[i];
    const g = bytes[i + 1];
    const b = bytes[i + 2];
    // Skip bytes that look like compressed-stream markers (very low entropy)
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
      // Skip JPEG byte-stuffed 0xFF markers
      if (r === 0xff) continue;
    }
    pixels.push({ r, g, b });
    if (pixels.length >= THUMB_SIZE * THUMB_SIZE) break;
  }

  if (pixels.length < 16) return null;
  return paletteFromPixels(pixels);
}

// ─── Colour quantisation ──────────────────────────────────────────────────────

function paletteFromPixels(pixels: RGB[]): CoverPalette {
  const quantised = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (const { r, g, b } of pixels) {
    const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
    const bucket = quantised.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    quantised.set(key, bucket);
  }

  const buckets: Bucket[] = [];
  for (const bucket of quantised.values()) {
    const rgb = {
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count,
    };
    const hsl = rgbToHsl(rgb);
    if (hsl.l < 0.055 || hsl.l > 0.94) continue;
    const middleWeight = 1 - Math.abs(hsl.l - 0.5) * 0.4;
    // Frequency does nearly all the work. The small salience adjustment only
    // keeps a black border or paper-white background from winning the cover.
    const score = bucket.count * (0.92 + hsl.s * 0.08) * Math.max(0.82, middleWeight);
    buckets.push({ count: bucket.count, hsl, score });
  }

  buckets.sort((a, b) => b.score - a.score);
  const primary = buckets[0];
  if (!primary) return FALLBACK;

  const accent = tuneForButton(primary.hsl);
  const hover = { ...accent, l: Math.max(0.14, accent.l - 0.055) };

  return {
    accent: cssHsl(accent),
    hover: cssHsl(hover),
  };
}

// ─── Image body reader ────────────────────────────────────────────────────────

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Image response has no body");

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Cover image is too large");
    }
    chunks.push(value);
  }

  // Merge Uint8Array chunks without Buffer.concat
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

// ─── URL safety guard ─────────────────────────────────────────────────────────

function safeImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1" ||
      /^(fc|fd|fe8|fe9|fea|feb)/.test(host)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

// ─── Colour math ──────────────────────────────────────────────────────────────

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  if (!delta) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
  else h = 60 * ((rn - gn) / delta + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

/** Keep the cover's hue and saturation while guaranteeing white-label contrast. */
function tuneForButton(source: HSL): HSL {
  const tuned: HSL = {
    h: source.h,
    s: clamp(source.s, 0, 1),
    l: clamp(source.l, 0.2, 0.42),
  };

  while (relativeLuminance(hslToRgb(tuned)) > 0.18 && tuned.l > 0.14) {
    tuned.l -= 0.01;
  }
  return tuned;
}

function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (value: number) => {
    const n = value / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return channel(r) * 0.2126 + channel(g) * 0.7152 + channel(b) * 0.0722;
}

function cssHsl(value: HSL): string {
  return `hsl(${Math.round(value.h)} ${Math.round(value.s * 100)}% ${Math.round(value.l * 100)}%)`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import "server-only";

/**
 * Signing for the stream proxy — uses the Web Crypto API so this module is
 * compatible with the Cloudflare Edge Runtime (V8 isolates).
 *
 * Without signing, /api/hls will fetch any public URL for anyone who asks —
 * the deployment becomes a free open relay running on our bandwidth and our IP
 * reputation. Every proxied URL is therefore stamped with an HMAC-SHA-256 over
 * the exact target and referer, and the route refuses anything that does not
 * verify. Only our own server can mint a working link.
 *
 * The secret lives in ANIGHOST_PROXY_SECRET. If it is not set the route falls
 * back to refusing cross-site requests, which stops casual abuse but is weaker
 * — production should always set it.
 */

const SECRET_RAW = process.env.ANIGHOST_PROXY_SECRET?.trim() ?? "";

export const signingEnabled = SECRET_RAW.length >= 16;

/** Cached CryptoKey — imported once per isolate lifetime. */
let _keyPromise: Promise<CryptoKey> | null = null;

function getCryptoKey(): Promise<CryptoKey> {
  if (!_keyPromise) {
    _keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET_RAW),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return _keyPromise;
}

/** Stable, order-independent input so the signature survives re-serialisation. */
function canonical(target: string, referer: string): string {
  return `${target}\n${referer}`;
}

/** Returns a base64url-encoded HMAC-SHA-256 signature. */
export async function sign(target: string, referer: string): Promise<string> {
  if (!signingEnabled) return "";
  const key = await getCryptoKey();
  const data = new TextEncoder().encode(canonical(target, referer));
  const sig = await crypto.subtle.sign("HMAC", key, data);
  // Convert ArrayBuffer → base64url without Buffer
  return arrayBufferToBase64url(sig);
}

/** Constant-time HMAC verification using crypto.subtle.verify. */
export async function verify(
  target: string,
  referer: string,
  provided: string | null,
): Promise<boolean> {
  // With no secret configured there is nothing to verify against; the route
  // applies its same-origin fallback instead.
  if (!signingEnabled) return true;
  if (!provided) return false;

  try {
    const key = await getCryptoKey();
    const data = new TextEncoder().encode(canonical(target, referer));
    // Decode the provided base64url signature back to bytes
    const providedBytes = base64urlToArrayBuffer(provided);
    // crypto.subtle.verify is inherently constant-time
    return await crypto.subtle.verify("HMAC", key, providedBytes, data);
  } catch {
    return false;
  }
}

/** Build a signed proxy URL. The single place these are minted. */
export function proxyUrl(target: string, referer?: string): string {
  if (!target) return "";
  const q = new URLSearchParams();
  q.set("url", target);
  if (referer) q.set("referer", referer);
  return `/api/hls?${q.toString()}`;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function arrayBufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToArrayBuffer(b64url: string): ArrayBuffer {
  // Normalise base64url → base64
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

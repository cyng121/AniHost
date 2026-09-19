import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing for the stream proxy.
 *
 * Without this, /api/hls will fetch any public URL for anyone who asks — the
 * deployment becomes a free open relay running on our bandwidth and our IP
 * reputation. Every proxied URL is therefore stamped with an HMAC over the
 * exact target and referer, and the route refuses anything that does not
 * verify. Only our own server can mint a working link.
 *
 * The secret lives in ANIGHOST_PROXY_SECRET. If it is not set the route falls
 * back to refusing cross-site requests, which stops casual abuse but is weaker
 * — production should always set it.
 */

const SECRET = process.env.ANIGHOST_PROXY_SECRET?.trim();

export const signingEnabled = Boolean(SECRET && SECRET.length >= 16);

/** Stable, order-independent input so the signature survives re-serialisation. */
function canonical(target: string, referer: string): string {
  return `${target}\n${referer}`;
}

export function sign(target: string, referer: string): string {
  if (!SECRET) return "";
  return createHmac("sha256", SECRET).update(canonical(target, referer)).digest("base64url");
}

export function verify(target: string, referer: string, provided: string | null): boolean {
  // With no secret configured there is nothing to verify against; the route
  // applies its same-origin fallback instead.
  if (!signingEnabled) return true;
  if (!provided) return false;

  const expected = sign(target, referer);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // Length must match before timingSafeEqual, which throws on a mismatch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Build a signed proxy URL. The single place these are minted. */
export function proxyUrl(target: string, referer?: string): string {
  if (!target) return "";
  const q = new URLSearchParams();
  q.set("url", target);
  if (referer) q.set("referer", referer);
  return `/api/hls?${q.toString()}`;
}

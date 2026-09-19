"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const BRAND_FALLBACK = "/brand/ani-ghost-compact.png";

type ArtworkImageProps = {
  src?: string | null;
  alt: string;
  sizes: string;
  className?: string;
  fallbackSrc?: string | null;
  priority?: boolean;
};

/**
 * Remote catalogue artwork is not fully under our control. This component
 * keeps its layout stable, retries with an optional provider fallback, then
 * lands on a local brand plate instead of leaving a broken-image glyph.
 */
export function ArtworkImage({
  src,
  alt,
  sizes,
  className,
  fallbackSrc,
  priority = false,
}: ArtworkImageProps) {
  const sources = useMemo(
    () =>
      [src, fallbackSrc, BRAND_FALLBACK].filter(
        (value, index, values): value is string =>
          Boolean(value) && values.indexOf(value) === index,
      ),
    [fallbackSrc, src],
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [src, fallbackSrc]);

  const activeSrc = sources[sourceIndex] ?? BRAND_FALLBACK;
  const isBrandFallback = activeSrc === BRAND_FALLBACK;

  return (
    <Image
      src={activeSrc}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized
      draggable={false}
      referrerPolicy="no-referrer"
      className={[
        "artwork-image",
        isBrandFallback ? "artwork-image--fallback" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onError={() =>
        setSourceIndex((current) => Math.min(current + 1, Math.max(0, sources.length - 1)))
      }
    />
  );
}

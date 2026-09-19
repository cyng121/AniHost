import { logoUrl, type TitleLogo as Logo } from "@/lib/logo";

/**
 * A title set in its own lettering.
 *
 * The name still ships as the element's text — it lives in `alt`, so screen
 * readers, search engines and anyone with images off get the title, not a gap.
 * When no logo was found the text simply renders as it always did, which is
 * why every caller passes the string as well as the logo.
 */
export function TitleLogo({
  logo,
  title,
  className,
  size = 500,
  cap = 200,
  priority = false,
}: {
  logo: Logo | null;
  title: string;
  /** Applied to the text fallback, so headings keep their type scale. */
  className?: string;
  size?: 300 | 500 | 780;
  /** Maximum rendered height in px. Logos vary wildly in aspect ratio. */
  cap?: number;
  priority?: boolean;
}) {
  if (!logo) return <span className={className}>{title}</span>;

  return (
    <img
      className="logo"
      src={logoUrl(logo, size)}
      alt={title}
      // A vector has no meaningful intrinsic size; leaving them off avoids
      // reserving the wrong box and shifting the layout when it loads.
      width={logo.vector ? undefined : logo.width}
      height={logo.vector ? undefined : logo.height}
      style={{ maxHeight: cap }}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

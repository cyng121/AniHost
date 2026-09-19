import Image from "next/image";

const LOGO_SRC = {
  compact: "/brand/ani-ghost-compact.png",
  hero: "/brand/ani-ghost-hero.png",
} as const;

type GhostProps = {
  className?: string;
  title?: string;
  variant?: keyof typeof LOGO_SRC;
  priority?: boolean;
};

/**
 * The Ani Ghost mark.
 *
 * Both supplied files are square canvases around a taller mark. CSS zooms each
 * source around its measured artwork centre, so the visible ghost fills the
 * established brand slots without stretching or clipping.
 */
export function Ghost({
  className,
  title,
  variant = "compact",
  priority = false,
}: GhostProps) {
  const classes = ["ghost", `ghost--${variant}`, className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Image
        className="ghost__image"
        src={LOGO_SRC[variant]}
        alt=""
        fill
        sizes={variant === "hero" ? "84px" : "44px"}
        priority={priority}
        draggable={false}
      />
    </span>
  );
}

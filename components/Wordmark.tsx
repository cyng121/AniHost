export function Wordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span className={["wordmark", className].filter(Boolean).join(" ")}>
      Ani Ghost
    </span>
  );
}

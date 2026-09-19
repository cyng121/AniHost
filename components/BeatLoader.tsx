"use client";

interface BeatLoaderProps {
  provider: string;
  className?: string;
  onClose?: () => void;
}

export function BeatLoader({ provider, className = "" }: BeatLoaderProps) {
  if (!provider) return null;

  const displayProvider =
    provider === "zoro"
      ? "Zoro (HiAnime)"
      : provider === "aniwave"
        ? "Aniwave"
        : provider === "anidao"
          ? "Anidao"
          : provider === "watchanimeworld"
            ? "AnimeWorld (Hindi)"
            : provider === "hindi"
              ? "Hindi Provider"
              : provider.toUpperCase();

  return (
    <div
      className={`beat-loader-top-center ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={`Switching to ${displayProvider}`}
    >
      <div className="beat-loader-glass-card">
        {/* Sleek Equalizer Beat Bars */}
        <div className="beat-bars-container" aria-hidden="true">
          <span className="beat-bar beat-bar--1" />
          <span className="beat-bar beat-bar--2" />
          <span className="beat-bar beat-bar--3" />
          <span className="beat-bar beat-bar--4" />
        </div>

        {/* Clean Status Text */}
        <div className="beat-loader-text">
          <span className="beat-loader-label">Switching to</span>
          <strong className="beat-loader-provider">{displayProvider}…</strong>
        </div>
      </div>
    </div>
  );
}

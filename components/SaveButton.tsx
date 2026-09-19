"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Bookmark } from "lucide-react";
import { isSaved, onSavesChange, toggleSave } from "@/lib/saves";

export function SaveButton({
  slug,
  title,
  image,
  type = "anime",
  rating,
  quality,
  variant = "button",
  className = "",
}: {
  slug: string;
  title: string;
  image?: string;
  type?: "anime" | "manga";
  rating?: string;
  quality?: string;
  variant?: "button" | "icon";
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setSaved(isSaved(slug, type));
    return onSavesChange(() => {
      setSaved(isSaved(slug, type));
    });
  }, [slug, type]);

  const onToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setAnimating(true);
    const next = toggleSave({
      id: slug,
      slug,
      title,
      image,
      type,
      rating,
      quality,
    });
    setSaved(next);
    setTimeout(() => setAnimating(false), 300);
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={`save-icon-btn ${saved ? "is-saved" : ""} ${animating ? "is-popping" : ""} ${className}`}
        onClick={onToggle}
        aria-label={saved ? `Remove ${title} from saved` : `Save ${title} for later`}
        title={saved ? "Saved in Watch Later" : "Save for later"}
      >
        <Bookmark size={15} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn ${saved ? "btn--saved is-saved" : "btn--ghost"} ${animating ? "is-popping" : ""} ${className}`}
      onClick={onToggle}
      aria-pressed={saved}
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
      <span>{saved ? "Saved" : type === "manga" ? "Read later" : "Watch later"}</span>
    </button>
  );
}

"use client";

import { useState } from "react";

export function ExpandableSynopsis({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="synopsis-wrap">
      <p className={`title__syn ${expanded ? "title__syn--expanded" : "title__syn--clamped"}`}>
        {text}
      </p>
      <button
        type="button"
        className="synopsis-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "See less" : "See more"}
      </button>
    </div>
  );
}

"use client";

import React from "react";

export function Highlight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`hero-highlight-pill ${className}`}>
      {children}
    </span>
  );
}

export function HeroHighlight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`hero-highlight-container ${className}`}>
      {children}
    </div>
  );
}

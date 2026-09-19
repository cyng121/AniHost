"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="wrap page">
      <div className="notice" role="alert">
        <h3>Something broke on our side</h3>
        <p>
          {error.message || "An unexpected error stopped this page from rendering."}
          {error.digest ? ` (${error.digest})` : ""}
        </p>
        <button className="btn btn--ghost" onClick={reset} style={{ marginTop: 16 }}>
          Try again.
        </button>
      </div>
    </main>
  );
}

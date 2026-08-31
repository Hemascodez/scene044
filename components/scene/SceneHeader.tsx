"use client";

import Link from "next/link";

export function Wordmark({ size = "text-xl" }: { size?: string }) {
  return (
    <span className="flex items-baseline gap-0.5">
      <span className={`font-display ${size} font-black tracking-tighter`}>SCENE</span>
      <span
        className={`bg-primary px-1.5 font-display ${size} font-black tracking-tighter text-primary-foreground`}
      >
        /044
      </span>
    </span>
  );
}

export function SceneHeader({
  view,
  onDiscover,
  onSaved,
  onSearch,
  savedCount,
}: {
  view: "discover" | "saved";
  onDiscover: () => void;
  onSaved: () => void;
  onSearch: () => void;
  savedCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background/95 backdrop-blur">
      <a
        href="#feed"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:border-2 focus:border-foreground focus:bg-card focus:px-3 focus:py-1.5 focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.14em]"
      >
        Skip to events
      </a>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
        <button type="button" onClick={onDiscover} className="group" aria-label="SCENE/044 — home">
          <Wordmark />
        </button>

        <nav className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDiscover}
            aria-current={view === "discover" ? "page" : undefined}
            className={`px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${
              view === "discover" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="hidden px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground sm:block"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onSaved}
            aria-current={view === "saved" ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 border-2 border-foreground px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              view === "saved" ? "bg-foreground text-background" : "hover:bg-secondary"
            }`}
          >
            Saved
            <span className="inline-flex min-w-4 items-center justify-center bg-primary-ink px-1 text-[10px] text-white">
              {savedCount}
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}

/** Plain-link header for routes that aren't the single-page app shell. */
export function SceneHeaderStatic() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
        <Link href="/" aria-label="SCENE/044 — home">
          <Wordmark />
        </Link>
        <Link
          href="/"
          className="px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← All fields
        </Link>
      </div>
    </header>
  );
}

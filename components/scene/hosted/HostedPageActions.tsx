"use client";

import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import { useSavedEvents } from "@/lib/client/useSavedEvents";
import { eventPath } from "@/lib/seo";
import { SaveIcon } from "@/components/scene/ui";

/** Paper buttons in the poster theme: cream, with an espresso outline. */
const GLASS_BASE =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 border px-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--h-ink)] shadow-[0_12px_28px_-18px_rgba(59,37,22,.55)] transition-colors duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--h-accent)]";
const GLASS = `${GLASS_BASE} border-[var(--h-line-strong)] bg-[var(--h-card)] hover:border-[var(--h-accent)] hover:bg-[#fffaf4]`;
/** Saved: filled espresso, like the poster's script. */
const GLASS_SAVED = `${GLASS_BASE} border-[var(--h-ink)] bg-[var(--h-ink)] !text-[var(--h-on-ink)] hover:bg-[var(--h-accent)] hover:border-[var(--h-accent)]`;

/** Save and Share for hosted events — the existing pair, minus "View original". */
export function HostedPageActions({ id, title, startAt }: { id: number; title: string; startAt: string | null }) {
  const saved = useSavedEvents();

  function share() {
    const when = startAt ? ` — ${formatSceneDate(startAt)}, ${formatSceneTime(startAt)} IST` : "";
    const text = `${title}${when}. Hosted by SCENE.`;
    const url = `${window.location.origin}${eventPath({ id, title })}`;
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {
        /* dismissed */
      });
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  const isSaved = saved.has(id);

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => saved.toggle(id)}
        aria-pressed={isSaved}
        className={isSaved ? GLASS_SAVED : GLASS}
      >
        <SaveIcon filled={isSaved} />
        {isSaved ? "Saved" : "Save"}
      </button>
      <button type="button" onClick={share} className={GLASS}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
        </svg>
        Share
      </button>
    </div>
  );
}

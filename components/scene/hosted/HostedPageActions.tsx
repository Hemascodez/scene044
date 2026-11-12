"use client";

import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import { useSavedEvents } from "@/lib/client/useSavedEvents";
import { eventPath } from "@/lib/seo";
import { SaveIcon } from "@/components/scene/ui";

/** Frosted glass over the hosted page's black-and-red background. */
const GLASS_BASE =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 border px-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#f4f2ea] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_12px_30px_-14px_rgba(0,0,0,.9)] backdrop-blur-md transition-colors duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const GLASS = `${GLASS_BASE} border-white/20 bg-white/[0.08] hover:border-white/35 hover:bg-white/[0.14]`;
/** Saved: the same glass, tinted SCENE red. */
const GLASS_SAVED = `${GLASS_BASE} border-[#ff6a55]/55 bg-[#ff2d16]/20 hover:bg-[#ff2d16]/30`;

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

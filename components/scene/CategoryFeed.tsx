"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicEvent } from "@/lib/events";
import { bySoonest, isHiddenFromFeed } from "@/lib/client/sceneEvent";
import { useEventInteractions } from "@/lib/client/useEventInteractions";
import { EventCard } from "@/components/scene/EventCard";
import { EventDetail } from "@/components/scene/EventDetail";
import { ReturnPrompt } from "@/components/scene/ReturnPrompt";

/** Per-field listing. Same card, save and return-prompt behaviour as the home
 *  feed — it shares `useEventInteractions` so the two can't diverge. */
export function CategoryFeed({ events }: { events: PublicEvent[] }) {
  const upcoming = useMemo(() => events.filter((e) => !isHiddenFromFeed(e)).sort(bySoonest), [events]);
  const interactions = useEventInteractions(upcoming);

  return (
    <>
      {upcoming.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center border-2 border-dashed border-foreground bg-card p-12 text-center">
          <span
            className="font-display text-6xl font-black tracking-tighter text-muted-foreground/30"
            aria-hidden
          >
            044
          </span>
          <h3 className="mt-4 font-display text-xl font-bold">Nothing in this field yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            SCENE/044 hasn&apos;t found an upcoming Chennai event here. New ones land as they&apos;re
            discovered.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center border-2 border-foreground bg-foreground px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            Back to all events →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          {upcoming.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              index={i}
              saved={interactions.isSaved(event.id)}
              lastViewed={event.id === interactions.lastViewedId}
              onToggleSave={() => interactions.toggleSaved(event.id)}
              onOpen={() => interactions.setOpenId(event.id)}
            />
          ))}
        </div>
      )}

      {interactions.openEvent && (
        <EventDetail
          event={interactions.openEvent}
          saved={interactions.isSaved(interactions.openEvent.id)}
          onToggleSave={() => interactions.toggleSaved(interactions.openEvent!.id)}
          onClose={() => interactions.setOpenId(null)}
          onVisit={interactions.handleVisit}
        />
      )}

      {interactions.returnEvent && (
        <ReturnPrompt
          event={interactions.returnEvent}
          saved={interactions.isSaved(interactions.returnEvent.id)}
          onSave={() => interactions.toggleSaved(interactions.returnEvent!.id)}
          onClose={interactions.dismissReturnPrompt}
        />
      )}
    </>
  );
}

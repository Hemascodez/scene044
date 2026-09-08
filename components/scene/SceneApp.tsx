"use client";

import { useMemo, useRef, useState } from "react";
import type { PublicEvent } from "@/lib/events";
import { FIELD_CARDS } from "@/lib/fieldCards";
import { bySoonest, deriveSceneStatus, isHiddenFromFeed, isNewlyDiscovered } from "@/lib/client/sceneEvent";
import { useEventInteractions } from "@/lib/client/useEventInteractions";
import { SceneHeader } from "@/components/scene/SceneHeader";
import { FieldsGrid, SceneFooter, SceneHero, SectionHead } from "@/components/scene/SceneHero";
import { TabbedFeed } from "@/components/scene/TabbedFeed";
import { EventCard } from "@/components/scene/EventCard";
import { ReturnPrompt } from "@/components/scene/ReturnPrompt";
import { Btn, Mono } from "@/components/scene/ui";

export function SceneApp({
  events,
  fetchFailed = false,
}: {
  events: PublicEvent[];
  fetchFailed?: boolean;
}) {
  const [view, setView] = useState<"discover" | "saved">("discover");
  const feedRef = useRef<HTMLElement>(null);
  const interactions = useEventInteractions(events);

  const upcoming = useMemo(() => events.filter((e) => !isHiddenFromFeed(e)).sort(bySoonest), [events]);
  // Wrapped, not passed by reference: `.filter` would hand the array index in
  // as the optional `now` argument.
  const newlyDiscovered = useMemo(() => upcoming.filter((e) => isNewlyDiscovered(e)), [upcoming]);
  const savedEvents = useMemo(
    () => events.filter((e) => interactions.savedIds.includes(e.id)).sort(bySoonest),
    [events, interactions.savedIds],
  );

  const counts = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const event of upcoming) {
      byCategory.set(event.category, (byCategory.get(event.category) ?? 0) + 1);
    }
    return Object.fromEntries(
      FIELD_CARDS.map((card) => [
        card.key,
        card.categories.reduce((sum, c) => sum + (byCategory.get(c) ?? 0), 0),
      ]),
    );
  }, [upcoming]);

  function scrollToFeed() {
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-full">
      <SceneHeader
        view={view}
        savedCount={interactions.savedIds.length}
        onDiscover={() => setView("discover")}
        onSaved={() => setView("saved")}
        onSearch={() => {
          setView("discover");
          requestAnimationFrame(scrollToFeed);
        }}
      />

      {view === "discover" ? (
        <>
          <SceneHero onExplore={scrollToFeed} />
          <FieldsGrid counts={counts} />

          <main ref={feedRef} id="feed" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-12 lg:px-6">
            <SectionHead
              kicker="Discovery feed"
              title="Browse the scene"
              note="Tap a tab · past events hidden"
            />

            <div className="mt-6">
              {fetchFailed ? (
                <FetchFailed />
              ) : upcoming.length === 0 ? (
                <NoUpcoming />
              ) : (
                <TabbedFeed
                  events={upcoming}
                  has={interactions.isSaved}
                  onToggleSave={interactions.toggleSaved}
                  lastViewedId={interactions.lastViewedId}
                />
              )}
            </div>

            {newlyDiscovered.length > 0 && (
              <div className="mt-16">
                <SectionHead
                  kicker="Fresh finds"
                  title="Newly discovered"
                  note="Pulled into SCENE/044 in the last few hours."
                />
                <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
                  {newlyDiscovered.map((event, i) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      index={i}
                      saved={interactions.isSaved(event.id)}
                      lastViewed={event.id === interactions.lastViewedId}
                      onToggleSave={() => interactions.toggleSaved(event.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </main>
        </>
      ) : (
        <SavedView
          events={savedEvents}
          isSaved={interactions.isSaved}
          onToggleSave={interactions.toggleSaved}
          onDiscover={() => setView("discover")}
          lastViewedId={interactions.lastViewedId}
        />
      )}

      <SceneFooter />

      {interactions.returnEvent && (
        <ReturnPrompt
          event={interactions.returnEvent}
          saved={interactions.isSaved(interactions.returnEvent.id)}
          onSave={() => interactions.toggleSaved(interactions.returnEvent!.id)}
          onClose={interactions.dismissReturnPrompt}
        />
      )}
    </div>
  );
}

function SavedView({
  events,
  isSaved,
  onToggleSave,
  onDiscover,
  lastViewedId,
}: {
  events: PublicEvent[];
  isSaved: (id: number) => boolean;
  onToggleSave: (id: number) => void;
  onDiscover: () => void;
  lastViewedId: number | null;
}) {
  // Anything no longer simply "confirmed" is worth flagging — someone who
  // shortlisted an event needs to know it was cancelled or moved.
  const changed = events.filter((e) => {
    const status = deriveSceneStatus(e);
    return status !== "confirmed" && status !== "expired";
  });

  return (
    <main id="feed" className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <SectionHead kicker="Your shortlist" title="Saved events" note="Kept in this browser · no account" />

      {changed.length > 0 && (
        <div className="mt-6 border-l-4 border-warn-ink bg-warn/10 px-4 py-3 text-sm">
          <b>{changed.length}</b> saved event{changed.length === 1 ? "" : "s"} changed since you saved{" "}
          {changed.length === 1 ? "it" : "them"} — check the status below.
        </div>
      )}

      {events.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center border-2 border-dashed border-foreground bg-card p-12 text-center">
          <span className="font-display text-6xl font-black tracking-tighter text-muted-foreground/30" aria-hidden>
            ⌾
          </span>
          <h3 className="mt-4 font-display text-xl font-bold">Nothing saved yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Tap the bookmark on any event to build a personal shortlist. It stays in this browser.
          </p>
          <div className="mt-5">
            <Btn variant="solid" onClick={onDiscover}>
              Discover events →
            </Btn>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
          {events.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              index={i}
              saved={isSaved(event.id)}
              lastViewed={event.id === lastViewedId}
              onToggleSave={() => onToggleSave(event.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function NoUpcoming() {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-foreground bg-card p-12 text-center">
      <span className="font-display text-6xl font-black tracking-tighter text-muted-foreground/30" aria-hidden>
        044
      </span>
      <h3 className="mt-4 font-display text-xl font-bold">No upcoming events right now</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Check back soon — new Chennai events are added as SCENE/044 finds them.
      </p>
    </div>
  );
}

function FetchFailed() {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary-ink bg-card p-12 text-center">
      <Mono className="text-[11px] text-primary-ink">Temporarily unavailable</Mono>
      <h3 className="mt-3 font-display text-xl font-bold">We couldn&apos;t load events just now</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <div className="mt-5">
        <Btn variant="solid" onClick={() => window.location.reload()}>
          Try again
        </Btn>
      </div>
    </div>
  );
}

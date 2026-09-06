"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicEvent } from "@/lib/events";
import { FIELD_CARDS } from "@/lib/fieldCards";
import { bySoonest, deriveSceneStatus, isHiddenFromFeed, isNewlyDiscovered } from "@/lib/client/sceneEvent";
import { useEventInteractions } from "@/lib/client/useEventInteractions";
import { markSplashConsumed, shouldPlaySplash } from "@/lib/client/splashGate";
import { SceneHeader } from "@/components/scene/SceneHeader";
import { FieldsGrid, SceneFooter, SceneHero, SectionHead } from "@/components/scene/SceneHero";
import { SplashScreen } from "@/components/scene/SplashScreen";
import { SubmitEventModal } from "@/components/scene/SubmitEventModal";
import { TabbedFeed } from "@/components/scene/TabbedFeed";
import { EventCard } from "@/components/scene/EventCard";
import { EventDetail } from "@/components/scene/EventDetail";
import { ReturnPrompt } from "@/components/scene/ReturnPrompt";
import { Btn, Mono } from "@/components/scene/ui";

export function SceneApp({
  events,
  deepLinkEventId,
  fetchFailed = false,
}: {
  events: PublicEvent[];
  deepLinkEventId: number | null;
  fetchFailed?: boolean;
}) {
  // A shared link is a direct request for one event — jumping through a 5s
  // intro to reach it would be hostile, so the splash is skipped entirely.
  // shouldPlaySplash() additionally suppresses it on client-side navigation
  // back to Home (wordmark, "Back to all events"), which is not a page load.
  const [showSplash, setShowSplash] = useState(deepLinkEventId === null && shouldPlaySplash());
  const [view, setView] = useState<"discover" | "saved">("discover");
  const [showSubmit, setShowSubmit] = useState(false);
  const feedRef = useRef<HTMLElement>(null);
  const interactions = useEventInteractions(events);
  const hasOpenedDeepLink = useRef(false);

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

  // Open the shared event's detail once the data is on screen.
  useEffect(() => {
    if (hasOpenedDeepLink.current || deepLinkEventId === null) return;
    if (!events.some((e) => e.id === deepLinkEventId)) return;
    hasOpenedDeepLink.current = true;
    interactions.setOpenId(deepLinkEventId);
  }, [deepLinkEventId, events, interactions]);

  // Marked after mount, not during render, so a re-render can't consume it.
  useEffect(markSplashConsumed, []);

  /*
   * Start at the top when the intro plays.
   *
   * history.scrollRestoration defaults to "auto", so on a reload the browser
   * silently restores the previous scroll position — underneath the splash,
   * where nobody can see it happening. The intro then lifts to reveal the
   * footer instead of the hero. Restoration is only suppressed when the splash
   * is actually playing, so Back still returns you to where you were.
   */
  useEffect(() => {
    if (!showSplash) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [showSplash]);

  function scrollToFeed() {
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-full">
      {showSplash && (
        <SplashScreen
          onDone={() => {
            // Belt and braces: anything that moved the page while the overlay
            // was up is undone before it is revealed.
            window.scrollTo(0, 0);
            setShowSplash(false);
          }}
        />
      )}

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
          <SceneHero onExplore={scrollToFeed} onSubmit={() => setShowSubmit(true)} />
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
                  onOpen={interactions.setOpenId}
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
                      onOpen={() => interactions.setOpenId(event.id)}
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
          onOpen={interactions.setOpenId}
          onDiscover={() => setView("discover")}
          lastViewedId={interactions.lastViewedId}
        />
      )}

      <SceneFooter />

      {interactions.openEvent && (
        <EventDetail
          event={interactions.openEvent}
          saved={interactions.isSaved(interactions.openEvent.id)}
          onToggleSave={() => interactions.toggleSaved(interactions.openEvent!.id)}
          onClose={() => interactions.setOpenId(null)}
          onVisit={interactions.handleVisit}
        />
      )}

      {showSubmit && <SubmitEventModal onClose={() => setShowSubmit(false)} />}

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
  onOpen,
  onDiscover,
  lastViewedId,
}: {
  events: PublicEvent[];
  isSaved: (id: number) => boolean;
  onToggleSave: (id: number) => void;
  onOpen: (id: number) => void;
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
              onOpen={() => onOpen(event.id)}
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

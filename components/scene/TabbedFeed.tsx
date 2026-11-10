"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicEvent } from "@/lib/events";
import { classifyDateBucket } from "@/lib/client/istTime";
import { isHiddenFromFeed, matchesSearch } from "@/lib/client/sceneEvent";
import { intercityCityOptions, isChennaiDiscoveryEvent, isIntercityEvent, normalizeEventCity } from "@/lib/eventLocations";
import { EventCard } from "@/components/scene/EventCard";
import { Btn, Mono } from "@/components/scene/ui";
import { LottiePlayer } from "@/components/ui/LottiePlayer";

interface Preset {
  key: string;
  label: string;
  hint: string;
  test: (event: PublicEvent) => boolean;
}

/*
 * "Free to attend" only counts events whose source explicitly said so
 * (schema.org `offers`/`isAccessibleForFree`, or a curator setting it by hand).
 * Events with no stated price are excluded rather than assumed free, so this
 * lane under-reports by design instead of over-promising.
 */
const PRESETS: Preset[] = [
  {
    key: "this_week",
    label: "This week",
    hint: "Next 7 days",
    test: (e) => {
      const bucket = classifyDateBucket(e.startAt);
      return bucket === "today" || bucket === "this_week" || bucket === "this_weekend";
    },
  },
  { key: "intercity", label: "Intercity", hint: "Discover something worth the trip · IST", test: isIntercityEvent },
  { key: "upcoming", label: "Upcoming in Chennai", hint: "Soonest first · IST", test: () => true },
  {
    key: "free",
    label: "Free to attend",
    hint: "Confirmed free by the source",
    test: (e) => e.priceType === "free",
  },
  { key: "online", label: "Online events", hint: "Join from anywhere", test: (e) => e.isOnline },
  { key: "offline", label: "Offline", hint: "In person across the city", test: (e) => !e.isOnline },
];

export function TabbedFeed({
  events,
  has,
  onToggleSave,
  lastViewedId,
}: {
  events: PublicEvent[];
  has: (id: number) => boolean;
  onToggleSave: (id: number) => void;
  lastViewedId: number | null;
}) {
  // "This week" is the view visitors land on — found by key rather than
  // hardcoded to an index, so a future reorder of PRESETS can't silently
  // change what opens by default.
  const [active, setActive] = useState(() => {
    const i = PRESETS.findIndex((p) => p.key === "this_week");
    return i === -1 ? 0 : i;
  });
  const [query, setQuery] = useState("");
  const [now] = useState(() => new Date());
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Search narrows the pool before it splits into panels, so the tab counts
  // always describe what the visitor is actually looking at.
  const upcoming = useMemo(() => events.filter((event) => !isHiddenFromFeed(event, now)
    && (!event.endAt || Date.parse(event.endAt) > now.getTime())), [events, now]);
  const cities = useMemo(() => intercityCityOptions(upcoming), [upcoming]);
  // Retain the city across tabs/searches, but recover if its last event disappears.
  const city = cities.some((option) => option.city === selectedCity) ? selectedCity : null;
  const pool = useMemo(() => upcoming.filter((e) => matchesSearch(e, query)), [upcoming, query]);
  const panels = useMemo(() => PRESETS.map((p) => ({
    preset: p,
    items: pool.filter((event) => (p.key === "intercity" || isChennaiDiscoveryEvent(event)) && p.test(event)),
  })), [pool]);
  const activePanel = panels[active];
  const shownItems = activePanel.items.filter((event) => activePanel.preset.key !== "intercity"
    || !city || normalizeEventCity(event.city) === city);

  /*
   * Tabs change only when a tab is tapped.
   *
   * These panels used to be a snap-scrolling horizontal strip you could swipe
   * between. On a phone that was actively hostile: the pane sits inside a
   * vertically scrolling page, so any downward flick with a few degrees of
   * horizontal drift silently switched category. People lost their place
   * without touching anything they meant to touch.
   *
   * Only the active panel is rendered now, which also means one panel's worth
   * of cards in the DOM instead of five.
   */
  function goTo(index: number) {
    setActive(index);
  }

  // Keep the selected pill visible inside the horizontally scrolling tab bar.
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tabRefs.current[active]?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", inline: "center", block: "nearest" });
  }, [active]);

  // Arrow-key navigation, which the tablist role promises.
  function onTabKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? panels.length - 1
      : e.key === "ArrowRight" ? (active + 1) % panels.length : (active - 1 + panels.length) % panels.length;
    goTo(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2">
        <span className="font-mono text-sm" aria-hidden>
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search events"
          placeholder="Search title, organizer, venue, city…"
          className="w-full bg-transparent py-1 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="font-mono text-xs text-muted-foreground hover:text-primary-ink"
          >
            clear
          </button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {shownItems.length} events in {activePanel.preset.label}{city && activePanel.preset.key === "intercity" ? `, ${city}` : ""}
      </p>

      <div className="sticky top-14 z-30 -mx-4 mt-4 bg-background/95 px-4 py-2 backdrop-blur lg:top-16">
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => goTo(0)}
            disabled={active === 0}
            aria-label="Back to first tab"
            className="flex shrink-0 items-center justify-center border-2 border-foreground bg-card px-2.5 font-mono text-sm transition-colors hover:bg-secondary disabled:opacity-30 disabled:hover:bg-card"
          >
            ‹
          </button>
          <div
            className="flex gap-2 overflow-x-auto pb-0.5"
            role="tablist"
            aria-label="Browse events"
            onKeyDown={onTabKeyDown}
          >
            {panels.map((panel, i) => {
              const on = i === active;
              return (
                <button
                  key={panel.preset.key}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${panel.preset.key}`}
                  aria-selected={on}
                  aria-controls={`panel-${panel.preset.key}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => goTo(i)}
                  className={`flex min-h-11 shrink-0 items-center gap-2 border-2 border-foreground px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    on ? "bg-foreground text-background" : "bg-card hover:bg-secondary"
                  }`}
                >
                  {panel.preset.label}
                  <span
                    className={`inline-flex min-w-4 items-center justify-center px-1 text-[10px] ${
                      on ? "bg-primary-ink text-white" : "bg-muted text-foreground"
                    }`}
                  >
                    {panel.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {panels.filter((_, i) => i === active).map((panel) => (
          <section
            key={panel.preset.key}
            role="tabpanel"
            id={`panel-${panel.preset.key}`}
            aria-labelledby={`tab-${panel.preset.key}`}
            className="w-full min-w-0"
          >
            {panel.preset.key === "intercity" && (
              <div className="mb-6 border-2 border-foreground bg-card p-4">
                <h3 className="font-display text-xl font-bold">Discover something worth the trip.</h3>
                <p className="mt-1 text-sm text-muted-foreground">Explore curated events beyond Chennai. Choose a city to see what’s coming up.</p>
                {cities.length > 0 && (
                  <div role="group" aria-label="Filter intercity events by city" className="mt-4 flex flex-wrap gap-2">
                    {[{ city: null, count: panel.items.length }, ...cities].map((option) => {
                      const selected = city === option.city;
                      const count = option.city === null ? option.count : panel.items.filter((event) => normalizeEventCity(event.city) === option.city).length;
                      return (
                        <button key={option.city ?? "all"} type="button" aria-pressed={selected}
                          onClick={() => setSelectedCity(option.city)}
                          className={`inline-flex min-h-11 items-center gap-2 border-2 border-foreground px-3 py-2 font-mono text-xs transition-colors ${selected ? "bg-foreground text-background" : "bg-card hover:bg-secondary"}`}>
                          {option.city ?? "All cities"}
                          <span className={selected ? "text-background/80" : "text-muted-foreground"}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="mb-4 flex items-baseline justify-between gap-2 border-b-2 border-dashed border-foreground/25 pb-2">
              <Mono className="text-[11px]">
                <span className="text-primary-ink">{shownItems.length}</span> event
                {shownItems.length === 1 ? "" : "s"}{panel.preset.key === "intercity" && city ? ` in ${city}` : ""}
              </Mono>
              <Mono className="text-[10px] text-muted-foreground">{panel.preset.hint}</Mono>
            </div>

            {shownItems.length === 0 ? (
              <PanelEmpty
                query={query}
                label={panel.preset.label}
                onClear={() => setQuery("")}
                onUpcoming={() => goTo(PRESETS.findIndex((preset) => preset.key === "upcoming"))}
              />
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
                {shownItems.map((event, i) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    index={i}
                    saved={has(event.id)}
                    lastViewed={event.id === lastViewedId}
                    onToggleSave={() => onToggleSave(event.id)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5">
        {panels.map((panel, i) => (
          <button
            key={panel.preset.key}
            type="button"
            aria-label={`Go to ${panel.preset.label}`}
            onClick={() => goTo(i)}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <span className={`h-1.5 transition-all ${i === active ? "w-6 bg-primary-ink" : "w-1.5 bg-muted-foreground/40"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelEmpty({
  query,
  label,
  onClear,
  onUpcoming,
}: {
  query: string;
  label: string;
  onClear: () => void;
  onUpcoming: () => void;
}) {
  const searching = query.trim().length > 0;
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-foreground bg-card p-12 text-center">
      <LottiePlayer
        src="/lottie/empty-search.json"
        className="size-24"
        fallback={
          <span className="font-display text-6xl font-black tracking-tighter text-muted-foreground/30" aria-hidden>
            044
          </span>
        }
      />
      <h3 className="mt-4 font-display text-xl font-bold">
        {searching ? "No events match that search" : `Nothing under ${label} right now`}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {searching
          ? "Try a broader term — an organizer, a field like “AI”, or a city."
          : label === "Intercity"
            ? "We’re adding events across India. Check back soon to discover upcoming events beyond Chennai."
          : label === "Free to attend"
            ? "No event has been confirmed free yet. We only list one here when the source says so outright — never by assuming."
            : "This lane is empty for now. Freshly discovered events land here as SCENE/044 finds them."}
      </p>
      <div className="mt-5">
        {searching ? (
          <Btn variant="solid" onClick={onClear}>
            Clear search
          </Btn>
        ) : (
          <Btn variant="solid" onClick={onUpcoming}>
            See all upcoming →
          </Btn>
        )}
      </div>
    </div>
  );
}

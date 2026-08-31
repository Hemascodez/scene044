"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicEvent } from "@/lib/events";
import { classifyDateBucket } from "@/lib/client/istTime";
import { matchesSearch } from "@/lib/client/sceneEvent";
import { EventCard } from "@/components/scene/EventCard";
import { Btn, Mono } from "@/components/scene/ui";

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
  { key: "upcoming", label: "Upcoming in Chennai", hint: "Soonest first · IST", test: () => true },
  {
    key: "this_week",
    label: "This week",
    hint: "Next 7 days",
    test: (e) => {
      const bucket = classifyDateBucket(e.startAt);
      return bucket === "today" || bucket === "this_week" || bucket === "this_weekend";
    },
  },
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
  onOpen,
  lastViewedId,
}: {
  events: PublicEvent[];
  has: (id: number) => boolean;
  onToggleSave: (id: number) => void;
  onOpen: (id: number) => void;
  lastViewedId: number | null;
}) {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Search narrows the pool before it splits into panels, so the tab counts
  // always describe what the visitor is actually looking at.
  const pool = useMemo(() => events.filter((e) => matchesSearch(e, query)), [events, query]);
  const panels = useMemo(() => PRESETS.map((p) => ({ preset: p, items: pool.filter(p.test) })), [pool]);

  function goTo(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior: "smooth" });
    setActive(index);
  }

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setActive((prev) => (prev === index ? prev : index));
  }

  // Keep the selected pill visible inside the horizontally scrolling tab bar.
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  // Arrow-key navigation, which the tablist role promises.
  function onTabKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? Math.min(active + 1, panels.length - 1) : Math.max(active - 1, 0);
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
          placeholder="Search title, organizer, venue, area…"
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
        {panels[active]?.items.length ?? 0} events in {panels[active]?.preset.label}
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
                  className={`flex shrink-0 items-center gap-2 border-2 border-foreground px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
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

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {panels.map((panel) => (
          <section
            key={panel.preset.key}
            role="tabpanel"
            id={`panel-${panel.preset.key}`}
            aria-labelledby={`tab-${panel.preset.key}`}
            className="w-full shrink-0 snap-start pr-0.5"
          >
            <div className="mb-4 flex items-baseline justify-between gap-2 border-b-2 border-dashed border-foreground/25 pb-2">
              <Mono className="text-[11px]">
                <span className="text-primary-ink">{panel.items.length}</span> event
                {panel.items.length === 1 ? "" : "s"}
              </Mono>
              <Mono className="text-[10px] text-muted-foreground">{panel.preset.hint}</Mono>
            </div>

            {panel.items.length === 0 ? (
              <PanelEmpty
                query={query}
                label={panel.preset.label}
                onClear={() => setQuery("")}
                onUpcoming={() => goTo(0)}
              />
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                {panel.items.map((event, i) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    index={i}
                    saved={has(event.id)}
                    lastViewed={event.id === lastViewedId}
                    onToggleSave={() => onToggleSave(event.id)}
                    onOpen={() => onOpen(event.id)}
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
            className={`h-1.5 transition-all ${
              i === active ? "w-6 bg-primary-ink" : "w-1.5 bg-muted-foreground/40"
            }`}
          />
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
      <span className="font-display text-6xl font-black tracking-tighter text-muted-foreground/30" aria-hidden>
        044
      </span>
      <h3 className="mt-4 font-display text-xl font-bold">
        {searching ? "No events match that search" : `Nothing under ${label} right now`}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {searching
          ? "Try a broader term — an organizer, a field like “AI”, or a Chennai neighbourhood."
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

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { VENUE_EVENT_TYPES, venueSearchHref } from "@/lib/venues";
import { VenueIcon } from "@/components/venues/VenueUi";

interface VenueSearchBarProps {
  defaults?: { location?: string; date?: string; time?: string; people?: string; eventType?: string };
  compact?: boolean;
}

export function VenueSearchBar({ defaults = {}, compact = false }: VenueSearchBarProps) {
  const router = useRouter();
  const [location, setLocation] = useState(defaults.location ?? "Nungambakkam, Chennai");
  const [date, setDate] = useState(defaults.date ?? "");
  const [time, setTime] = useState(defaults.time ?? "18:00");
  const [people, setPeople] = useState(defaults.people ?? "25");
  const [eventType, setEventType] = useState(defaults.eventType ?? "Tech meetup");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(venueSearchHref({ location, date, time, people, eventType }));
  }

  return (
    <form
      onSubmit={submit}
      // Gap-as-border: a 1px gap over a tinted background draws the dividing
      // lines, so they stay correct at every column count instead of needing
      // a different border-side utility per breakpoint (the previous version
      // only ever laid out in a row from `lg:` up, so every tablet width —
      // portrait or landscape iPad included — got the single stacked-column
      // mobile layout with no room-appropriate use of the space).
      className={`venue-search-grid grid w-full grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-foreground/15 bg-foreground/10 shadow-[0_18px_55px_rgba(20,19,13,0.12)] sm:grid-cols-2 ${compact ? "lg:grid-cols-[1.2fr_1fr_.75fr_.8fr_auto]" : "lg:grid-cols-[1.35fr_1fr_.8fr_.8fr_auto]"}`}
      aria-label="Search venues"
    >
      <label className="group flex min-w-0 flex-col bg-card px-4 py-3 hover:bg-secondary/50 sm:col-span-2 lg:col-span-1">
        <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><VenueIcon name="map" className="size-3.5" /> Where</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Area or city" className="mt-1 min-w-0 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/60" />
      </label>
      <label className="flex min-w-0 flex-col bg-card px-4 py-3 hover:bg-secondary/50">
        <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><VenueIcon name="calendar" className="size-3.5" /> Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 min-w-0 bg-transparent text-sm font-semibold outline-none" aria-label="Event date" />
      </label>
      <label className="flex min-w-0 flex-col bg-card px-4 py-3 hover:bg-secondary/50">
        <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><VenueIcon name="clock" className="size-3.5" /> Starts</span>
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 min-w-0 bg-transparent text-sm font-semibold outline-none" aria-label="Start time" />
      </label>
      <label className="flex min-w-0 flex-col bg-card px-4 py-3 hover:bg-secondary/50">
        <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><VenueIcon name="people" className="size-3.5" /> People</span>
        <input type="number" min="1" max="100" value={people} onChange={(event) => setPeople(event.target.value)} className="mt-1 min-w-0 bg-transparent text-sm font-semibold outline-none" aria-label="Number of people" />
      </label>
      <label className="sr-only" htmlFor="venue-event-type">Event type</label>
      <select id="venue-event-type" value={eventType} onChange={(event) => setEventType(event.target.value)} className="min-w-0 max-w-full bg-card px-4 py-3 text-sm font-semibold outline-none sm:col-span-2 lg:col-span-1 lg:hidden">
        {VENUE_EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}
      </select>
      <div className="flex items-center bg-card p-2.5 sm:col-span-2 lg:col-span-1">
        <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-ink active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:w-auto" aria-label="Show matching venues">
          <VenueIcon name="search" className="size-5" /> <span className="lg:hidden xl:inline">Show venues</span>
        </button>
      </div>
    </form>
  );
}

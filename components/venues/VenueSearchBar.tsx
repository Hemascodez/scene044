"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { VENUE_EVENT_TYPES, venueSearchHref } from "@/lib/venues";
import { DEFAULT_VENUE_SEARCH, readVenueSearchPreferences, saveVenueSearchPreferences, type VenueSearchValues } from "@/lib/venueSearch";
import { VenueIcon, type VenueIconName } from "@/components/venues/VenueUi";

interface VenueSearchBarProps {
  defaults?: { location?: string; date?: string; time?: string; people?: string; eventType?: string };
  compact?: boolean;
}

const CELL = "flex min-w-0 flex-col bg-white px-5 py-4 transition-colors focus-within:bg-venue-paper";
const CAPTION = "flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
const CONTROL = "mt-1 min-w-0 bg-transparent text-[13px] font-medium leading-5 text-foreground outline-none placeholder:text-muted-foreground/60";

function Field({ icon, label, children }: { icon: VenueIconName; label: string; children: ReactNode }) {
  return (
    <label className={CELL}>
      <span className={CAPTION}>
        <VenueIcon name={icon} className="size-3.5" /> {label}
      </span>
      {children}
    </label>
  );
}

export function VenueSearchBar({ defaults = {}, compact = false }: VenueSearchBarProps) {
  const router = useRouter();
  const [values, setValues] = useState<VenueSearchValues>({ ...DEFAULT_VENUE_SEARCH, ...defaults });
  const defaultsKey = JSON.stringify(defaults);
  useEffect(() => {
    const explicit = JSON.parse(defaultsKey) as Partial<VenueSearchValues>;
    const restored = { ...DEFAULT_VENUE_SEARCH, ...readVenueSearchPreferences(), ...explicit };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore tab preferences after hydration; URL values take precedence
    setValues(restored);
    saveVenueSearchPreferences(restored);
  }, [defaultsKey]);
  const { location, date, time, people, eventType } = values;
  function change(key: keyof VenueSearchValues, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    saveVenueSearchPreferences(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveVenueSearchPreferences(values);
    router.push(venueSearchHref(values));
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      // Gap-as-border: a 1px gap over a tinted background draws the dividing
      // lines, so they stay correct at every column count instead of needing a
      // different border-side utility per breakpoint.
      className={`venue-search-grid grid w-full grid-cols-1 gap-px border-[1.5px] border-foreground bg-foreground/20 shadow-hard sm:grid-cols-2 ${
        compact ? "lg:grid-cols-[1.2fr_1fr_1fr_.75fr_.75fr_auto]" : "lg:grid-cols-[1.25fr_1.1fr_1fr_.8fr_.8fr_auto]"
      }`}
      aria-label="Search venues"
    >
      <Field icon="map" label="Where">
        <input value={location} onChange={(event) => change("location", event.target.value)} placeholder="Area or city" className={CONTROL} />
      </Field>
      <Field icon="spark" label="Format">
        <span className="relative">
          <select value={eventType} onChange={(event) => change("eventType", event.target.value)} aria-label="Event type" className={`${CONTROL} w-full appearance-none pr-6`}>
            {VENUE_EVENT_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <VenueIcon name="chevron" className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2" />
        </span>
      </Field>
      <Field icon="calendar" label="Date">
        <input type="date" value={date} onChange={(event) => change("date", event.target.value)} className={CONTROL} aria-label="Event date" />
      </Field>
      <Field icon="clock" label="Starts">
        <input type="time" value={time} onChange={(event) => change("time", event.target.value)} className={CONTROL} aria-label="Start time" />
      </Field>
      <Field icon="people" label="People">
        <input type="number" min="1" step="1" value={people} onChange={(event) => change("people", event.target.value)} placeholder="Any group size" className={CONTROL} aria-label="Number of people" />
      </Field>
      <button
        type="submit"
        aria-label="Show matching spaces"
        className="flex min-h-14 items-center justify-center gap-2 bg-primary px-6 font-mono text-xs font-bold uppercase tracking-[0.08em] text-white transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground sm:col-span-2 lg:col-span-1 lg:w-[68px] lg:px-0"
      >
        <VenueIcon name="search" className="size-5" />
        <span className="lg:sr-only">Search</span>
      </button>
    </form>
  );
}

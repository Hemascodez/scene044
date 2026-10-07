import { VENUE_EVENT_TYPES, venueSearchHref, type VenueSpace } from "./venues";

export type VenueSearchValues = { location: string; date: string; time: string; people: string; eventType: string };
export const DEFAULT_VENUE_SEARCH: VenueSearchValues = {
  location: "Nungambakkam, Chennai", date: "", time: "18:00", people: "", eventType: "Tech meetup",
};

export function venueSearchValues(params: Record<string, string | string[] | undefined>): VenueSearchValues {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const eventType = first(params.eventType);
  return {
    location: (first(params.location) ?? DEFAULT_VENUE_SEARCH.location).slice(0, 150),
    date: first(params.date) ?? "",
    time: first(params.time) ?? DEFAULT_VENUE_SEARCH.time,
    people: first(params.people) ?? "",
    eventType: eventType && (VENUE_EVENT_TYPES as readonly string[]).includes(eventType) ? eventType : DEFAULT_VENUE_SEARCH.eventType,
  };
}

/** Null means no capacity filter; NaN means an invalid filter, never a match. */
export function requestedCapacity(people: string): number | null {
  if (!people.trim()) return null;
  const value = Number(people);
  return Number.isSafeInteger(value) && value > 0 ? value : NaN;
}

export function matchingSpaces<T extends VenueSpace>(spaces: readonly T[], people: string): T[] {
  const capacity = requestedCapacity(people);
  return spaces.filter(space => capacity === null || space.maxGuests >= capacity);
}

export function venueDetailSearchHref(slug: string, values: Partial<VenueSearchValues>, spaceId?: string) {
  const search = venueSearchHref(values).split("?")[1];
  const params = new URLSearchParams(search);
  if (spaceId) params.set("spaceId", spaceId);
  return `/venues/${encodeURIComponent(slug)}${params.size ? `?${params}` : ""}`;
}

const KEY = "scene044.venueSearch.v1";
/** Search preferences contain no account data. They persist only in this tab. */
export function readVenueSearchPreferences(): Partial<VenueSearchValues> {
  try {
    const data: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const values: Partial<VenueSearchValues> = {};
    for (const key of Object.keys(DEFAULT_VENUE_SEARCH) as (keyof VenueSearchValues)[]) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string") values[key] = value.slice(0, 150);
    }
    return values;
  } catch { return {}; }
}

export function saveVenueSearchPreferences(values: VenueSearchValues) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(values)); } catch { /* storage is optional */ }
}

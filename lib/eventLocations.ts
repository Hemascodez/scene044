import type { PublicEvent } from "@/lib/events";

const CITY_ALIASES: Record<string, string> = {
  chennai: "Chennai", madras: "Chennai",
  bengaluru: "Bengaluru", bangalore: "Bengaluru",
  coimbatore: "Coimbatore", kovai: "Coimbatore",
  mumbai: "Mumbai", bombay: "Mumbai",
  pune: "Pune", poona: "Pune",
  hyderabad: "Hyderabad", delhi: "Delhi", "new delhi": "New Delhi",
  gurugram: "Gurugram", gurgaon: "Gurugram",
  kolkata: "Kolkata", calcutta: "Kolkata",
  kochi: "Kochi", cochin: "Kochi",
  thiruvananthapuram: "Thiruvananthapuram", trivandrum: "Thiruvananthapuram",
  tiruchirappalli: "Tiruchirappalli", trichy: "Tiruchirappalli",
  puducherry: "Puducherry", pondicherry: "Puducherry",
  ahmedabad: "Ahmedabad", chandigarh: "Chandigarh", jaipur: "Jaipur",
  indore: "Indore", lucknow: "Lucknow", nagpur: "Nagpur", madurai: "Madurai",
  // Source addressLocality often contains a Chennai neighbourhood.
  thoraipakkam: "Chennai", perungudi: "Chennai", tharamani: "Chennai", taramani: "Chennai",
  velachery: "Chennai", adyar: "Chennai", guindy: "Chennai", kilpauk: "Chennai",
  nungambakkam: "Chennai", mylapore: "Chennai", teynampet: "Chennai",
  "anna nagar": "Chennai", "besant nagar": "Chennai", porur: "Chennai",
};

export const EVENT_CITY_SUGGESTIONS = [...new Set(Object.values(CITY_ALIASES))]
  .sort((a, b) => a.localeCompare(b, "en-IN"));

/** Only use the location field, never cities mentioned in an event's copy.
 * Unknown cities remain valid so publishing in a new city needs no code change. */
export function normalizeEventCity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const city = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!city || city.length > 80 || !/^[\p{L}\p{M} .’'-]+$/u.test(city)) return null;
  const key = city.toLocaleLowerCase("en-IN");
  if (/^(?:online|virtual|remote|anywhere|india|unknown|tba|tbd|to be (?:announced|confirmed)|tamil nadu|karnataka|maharashtra)$/.test(key)) return null;
  return Object.hasOwn(CITY_ALIASES, key) ? CITY_ALIASES[key] : city.replace(/\p{L}[\p{L}\p{M}]*/gu, (word) =>
    word.charAt(0).toLocaleUpperCase("en-IN") + word.slice(1).toLocaleLowerCase("en-IN"));
}

/** Recognise explicit city segments in venue locations, not words in titles,
 * descriptions or a business name such as "Delhi Public School". Multiple
 * different cities are ambiguous and need curator review. */
export function cityFromEventLocation(venueName: unknown, venueAddress: unknown): string | null {
  const cities = new Set<string>();
  for (const value of [venueAddress, venueName]) {
    if (typeof value !== "string") continue;
    for (const part of value.split(/[,;\n|]+/)) {
      const key = part.normalize("NFKC").replace(/\b\d{6}\b/g, "")
        .replace(/[\s.-]+$/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-IN");
      if (Object.hasOwn(CITY_ALIASES, key)) cities.add(CITY_ALIASES[key]);
    }
  }
  return cities.size === 1 ? [...cities][0] : null;
}

export function eventCityError(input: { city?: unknown; isOnline: boolean; venueName?: unknown; venueAddress?: unknown }): string | null {
  if (input.isOnline) return null;
  const city = normalizeEventCity(input.city);
  if (!city) return "Choose the event city before publishing (city name only).";
  const locationCity = cityFromEventLocation(input.venueName, input.venueAddress);
  if (locationCity && locationCity !== city) return `The venue location says ${locationCity}, but the selected city is ${city}. Correct the city or venue location.`;
  return null;
}

export function eventFeedDestination(city: unknown, isOnline: boolean): string {
  if (isOnline) return "Online events";
  const normalized = normalizeEventCity(city);
  if (!normalized) return "Choose a city to see where this event will appear.";
  return normalized === "Chennai" ? "Chennai · This week / Upcoming (based on date)" : `Intercity → ${normalized}`;
}

type LocatedEvent = Pick<PublicEvent, "city" | "isOnline">;

export function isChennaiDiscoveryEvent(event: LocatedEvent): boolean {
  return event.isOnline || normalizeEventCity(event.city) === "Chennai";
}

export function isIntercityEvent(event: LocatedEvent): boolean {
  const city = normalizeEventCity(event.city);
  return !event.isOnline && city !== null && city !== "Chennai";
}

/** Call with upcoming published events; never seed empty cities from a fixed list. */
export function intercityCityOptions(events: readonly LocatedEvent[]): { city: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!isIntercityEvent(event)) continue;
    const city = normalizeEventCity(event.city)!;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts].map(([city, count]) => ({ city, count }))
    .sort((a, b) => a.city.localeCompare(b.city, "en-IN"));
}

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
};

/** Only use the location field, never cities mentioned in an event's copy.
 * Unknown cities remain valid so publishing in a new city needs no code change. */
export function normalizeEventCity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const city = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!city || city.length > 80 || !/^[\p{L}\p{M} .’'-]+$/u.test(city)) return null;
  const key = city.toLocaleLowerCase("en-IN");
  if (/^(?:online|virtual|remote|anywhere|india|unknown|tba|tbd|to be (?:announced|confirmed))$/.test(key)) return null;
  return Object.hasOwn(CITY_ALIASES, key) ? CITY_ALIASES[key] : city.replace(/\p{L}[\p{L}\p{M}]*/gu, (word) =>
    word.charAt(0).toLocaleUpperCase("en-IN") + word.slice(1).toLocaleLowerCase("en-IN"));
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

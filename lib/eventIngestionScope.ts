import { eventAddressRegion, normalizeEventCity } from "./eventLocations";

/** Search hints are discovery only. They must NEVER become an event's city. */
export const INGESTION_LOCATIONS = [
  "Chennai", "Bengaluru Bangalore", "Mumbai", "Delhi New Delhi", "Gurugram Gurgaon", "Kerala", "Kochi Cochin",
  "Thiruvananthapuram Trivandrum", "Kozhikode Calicut", "Thrissur", "Kollam",
  "Kannur", "Kottayam", "Alappuzha", "Palakkad", "Malappuram", "Kasaragod",
  "Pathanamthitta", "Idukki", "Wayanad",
] as const;

export const INGESTION_MARKETS = ["Chennai", "Bengaluru", "Mumbai", "Delhi", "Gurugram", "Kerala"] as const;
export type IngestionMarket = typeof INGESTION_MARKETS[number];

/** Scheduling bucket only; Delhi includes New Delhi, Kerala includes every town. */
export function ingestionMarket(value: string | null | undefined): IngestionMarket | null {
  if (value?.trim().toLowerCase() === "kerala") return "Kerala";
  const city = normalizeEventCity(value);
  if (city === "New Delhi") return "Delhi";
  if (city && eventAddressRegion(city) === "Kerala") return "Kerala";
  return INGESTION_MARKETS.find(market => market === city) ?? null;
}

/** Invalid/empty filters must fail closed rather than accidentally run globally. */
export function ingestionMarkets(values?: readonly string[]): IngestionMarket[] {
  return [...new Set((values ?? []).map(value => {
    const market = ingestionMarket(value);
    if (!market) throw new Error(`Unsupported ingestion market: ${value}`);
    return market;
  }))];
}

export function ingestionLocationAllowed(event: {
  city?: string | null; isOnline: boolean; venueAddress?: string | null;
}): boolean {
  if (event.isOnline) return true;
  const city = normalizeEventCity(event.city);
  if (!city) return false;
  if (["Chennai", "Bengaluru", "Mumbai", "Delhi", "New Delhi", "Gurugram"].includes(city)) return true;
  // Includes smaller Kerala towns not in our aliases, provided the event's
  // own structured/visible address explicitly identifies the state.
  return eventAddressRegion(city) === "Kerala"
    || /(?:^|[,;\n])\s*Kerala(?:\s+\d{6})?\s*(?:[,;\n]|$)/i.test(event.venueAddress ?? "");
}

/** Detail facts only; supports small Kerala towns with explicit state evidence. */
export function eventIngestionMarket(event: {
  city?: string | null; isOnline: boolean; venueAddress?: string | null;
}): IngestionMarket | null {
  if (event.isOnline || !ingestionLocationAllowed(event)) return null;
  return ingestionMarket(event.city) ?? "Kerala";
}

export function buildIngestionQueries() {
  // Broad queries include every existing category rather than limiting the
  // search to tech. Category assignment happens from each detail page later.
  const topics = ["upcoming tech AI startup marketing arts community events meetups workshops"];
  return INGESTION_LOCATIONS.flatMap(location =>
    ["luma.com", "meetup.com", "kynhood.com"].flatMap(domain => topics.map(topic => ({
      query_text: `${location} ${topic}`,
      category_hint: null,
      site_filter: `site:${domain}`,
      discovery_market: ingestionMarket(location.split(" ")[0]),
      priority: ["Chennai", "Bengaluru Bangalore", "Mumbai", "Delhi New Delhi", "Gurugram Gurgaon", "Kerala"].includes(location) ? 10 : 0,
    }))));
}

/** These feeds were checked publicly. Luma /chennai currently falls back to
 * global discovery, so it is deliberately NOT assumed to be a Chennai feed. */
export const EVENT_DISCOVERY_FEED_CONFIG: readonly { url: string; market: IngestionMarket | null }[] = [
  { url: "https://luma.com/bengaluru", market: "Bengaluru" },
  { url: "https://luma.com/mumbai", market: "Mumbai" },
  // Public response checked 2026-11-24: /delhi redirects to this city calendar.
  // /gurugram is a past event detail, NOT a feed; do not guess city URLs.
  { url: "https://luma.com/new-delhi", market: "Delhi" },
  // This directory has no guaranteed single market.
  { url: "https://kynhood.com/eventhome", market: null },
];
export const EVENT_DISCOVERY_FEEDS = EVENT_DISCOVERY_FEED_CONFIG.map(feed => feed.url);

import { eventAddressRegion, normalizeEventCity } from "./eventLocations";

/** Search hints are discovery only. They must NEVER become an event's city. */
export const INGESTION_LOCATIONS = [
  "Chennai", "Bengaluru Bangalore", "Mumbai", "Kerala", "Kochi Cochin",
  "Thiruvananthapuram Trivandrum", "Kozhikode Calicut", "Thrissur", "Kollam",
  "Kannur", "Kottayam", "Alappuzha", "Palakkad", "Malappuram", "Kasaragod",
  "Pathanamthitta", "Idukki", "Wayanad",
] as const;

export function ingestionLocationAllowed(event: {
  city?: string | null; isOnline: boolean; venueAddress?: string | null;
}): boolean {
  if (event.isOnline) return true;
  const city = normalizeEventCity(event.city);
  if (!city) return false;
  if (["Chennai", "Bengaluru", "Mumbai"].includes(city)) return true;
  // Includes smaller Kerala towns not in our aliases, provided the event's
  // own structured/visible address explicitly identifies the state.
  return eventAddressRegion(city) === "Kerala"
    || /(?:^|[,;\n])\s*Kerala(?:\s+\d{6})?\s*(?:[,;\n]|$)/i.test(event.venueAddress ?? "");
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
      priority: ["Chennai", "Bengaluru Bangalore", "Mumbai", "Kerala"].includes(location) ? 10 : 0,
    }))));
}

/** These feeds were checked publicly. Luma /chennai currently falls back to
 * global discovery, so it is deliberately NOT assumed to be a Chennai feed. */
export const EVENT_DISCOVERY_FEEDS = [
  "https://luma.com/bengaluru", "https://luma.com/mumbai", "https://kynhood.com/eventhome",
] as const;

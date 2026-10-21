import type { PublicEvent, PublicEventDetail } from "@/lib/events";
import { formatSceneDateLong, formatSceneTime } from "@/lib/client/istTime";
import { posterFor, eventShortIntro } from "@/lib/client/sceneEvent";
import { getFieldCardForCategory, type FieldCard } from "@/lib/fieldCards";
import type { CatalogVenue } from "@/lib/venueCatalog";
import { venueSearchDescription, venueSearchIntent, VENUES_SEARCH_DESCRIPTION, VENUES_SEARCH_TITLE } from "@/lib/venueDiscovery";
import { eventCollectionPath, EVENTS_SEARCH_DESCRIPTION, EVENTS_SEARCH_TITLE, type EventCollection } from '@/lib/eventDiscovery';

export const SITE_NAME = "SCENE/044";
export const SITE_URL = "https://scene044.in";

/** Stable human-readable URL. The id is authoritative, so title edits only
 * cause an automatic canonical redirect and can never collide. */
export function eventSlug(event: Pick<PublicEvent, "id" | "title">): string {
  const title = event.title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return `${title || "event"}-${event.id}`;
}

export function eventPath(event: Pick<PublicEvent, "id" | "title">): string {
  return `/events/${eventSlug(event)}`;
}

export function venuePath(venue: Pick<CatalogVenue, "slug">): string {
  return `/venues/${venue.slug}`;
}

export function eventIdFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, SITE_URL).toString();
}

export function eventImageUrl(event: PublicEvent): string {
  return absoluteUrl(posterFor(event).src);
}

export function truncateSeoText(value: string, maxLength = 160): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  const candidate = compact.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const clean = lastSpace >= Math.floor(maxLength * 0.65) ? candidate.slice(0, lastSpace) : candidate;
  return `${clean.replace(/[\s,.;:—-]+$/g, "")}…`;
}

export function eventSeoDescription(event: PublicEvent): string {
  const summary = eventShortIntro(event);
  const when = event.startAt
    ? `${formatSceneDateLong(event.startAt)}, ${formatSceneTime(event.startAt)} IST`
    : "date to be announced";
  const where = event.isOnline ? "online" : [event.venueName, event.city].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(', ');
  return truncateSeoText(
    `${when} · ${where}.${event.priceType === 'free' ? ' Free entry.' : event.priceNote ? ` ${event.priceNote}.` : ''} ${summary || `${event.title}. See event details and the original registration link on SCENE/044.`}`,
  );
}

export function eventSeoTitle(event: PublicEvent): string {
  const location = event.isOnline ? 'Online event' : `${event.city || 'Chennai'} event`;
  return `${event.title} — ${location} | SCENE/044`;
}

/** Metadata only: never rewrites the curator's visible copy or pricing. */
export function venueSeoDescription(venue: CatalogVenue): string {
  return truncateSeoText(venueSearchDescription(venue));
}

export function venueSeoTitle(venue: CatalogVenue): string {
  const purpose = venueSearchIntent(venue)?.title ?? 'Event Space';
  return `${venue.name} — ${purpose} in ${venue.area}, ${venue.city} | SCENE/044`;
}

/** Describe only the live listings actually rendered on the venue landing. */
export function venueCollectionStructuredData(venues: CatalogVenue[]): Record<string, unknown> {
  const live = venues.filter(venue => venue.status === 'live');
  const url = absoluteUrl('/venues');
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: VENUES_SEARCH_TITLE,
    description: VENUES_SEARCH_DESCRIPTION,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: live.length,
      itemListElement: live.map((venue, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: venue.name,
        url: absoluteUrl(venuePath(venue)),
      })),
    },
  };
}

export function categorySeoDescription(card: FieldCard): string {
  const topics: Record<string, string> = {
    ai: 'AI meetups, machine learning workshops, agent-building sessions and applied AI talks',
    tech: 'tech events, developer meetups, software engineering talks, hackathons and coding workshops',
    cybersecurity: 'cybersecurity meetups, AppSec talks, privacy workshops and security community events',
    'product-design': 'product and UX design meetups, design workshops and product community events',
    marketing: 'marketing events, growth meetups, brand talks and content community sessions',
    startups: 'startup events, founder meetups, business networking and entrepreneurship sessions',
    data: 'data and cloud events, analytics meetups and infrastructure workshops',
    finance: 'finance events, fintech meetups, payments talks and financial technology workshops',
  };
  return truncateSeoText(
    `Find upcoming ${topics[card.key] ?? `${card.label.toLowerCase()} events`} in Chennai. Check dates, venues and original registration links on SCENE/044.`,
  );
}

export function categorySeoHeading(card: FieldCard): string {
  return `${card.key === 'tech' ? 'Tech & Developer' : card.label} Events in Chennai`;
}

function eventListingStructuredData(name: string, description: string, path: string, events: PublicEvent[]): Record<string, unknown> {
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${url}#collection`,
    url, name, description, inLanguage: 'en-IN',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: events.length,
      itemListElement: events.map((event, index) => ({
        '@type': 'ListItem', position: index + 1, name: event.title, url: absoluteUrl(eventPath(event)),
      })),
    },
  };
}

export function homeEventStructuredData(events: PublicEvent[]): Record<string, unknown> {
  return eventListingStructuredData(EVENTS_SEARCH_TITLE, EVENTS_SEARCH_DESCRIPTION, '/', events);
}

export function eventCollectionStructuredData(collection: EventCollection, events: PublicEvent[]): Record<string, unknown> {
  return {
    ...eventListingStructuredData(collection.title, collection.description, eventCollectionPath(collection), events),
    breadcrumb: {
      '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Chennai events', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: collection.title, item: absoluteUrl(eventCollectionPath(collection)) },
      ],
    },
  };
}

/** JSON is escaped before insertion in a script tag so source-controlled or
 * scraped text containing "<" cannot terminate the element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function numericInrPrice(note: string | null): string | null {
  if (!note) return null;
  const match = note.match(/(?:₹|INR|Rs\.?)[\s:]*(\d[\d,]*(?:\.\d{1,2})?)/i);
  return match ? match[1].replace(/,/g, "") : null;
}

function eventStatusUrl(status: PublicEventDetail["status"]): string {
  if (status === "cancelled") return "https://schema.org/EventCancelled";
  if (status === "postponed") return "https://schema.org/EventPostponed";
  return "https://schema.org/EventScheduled";
}

/** Google requires startDate for an Event rich result. Honest undated
 * listings still get a useful page, but no knowingly-invalid Event object. */
export function eventStructuredData(event: PublicEventDetail): Record<string, unknown> | null {
  if (!event.startAt || !Number.isFinite(Date.parse(event.startAt))) return null;

  const canonicalUrl = absoluteUrl(eventPath(event));
  const location = event.isOnline
    ? {
        "@type": "VirtualLocation",
        url: event.primarySourceUrl,
      }
    : {
        "@type": "Place",
        name: event.venueName ?? event.city,
        address: {
          "@type": "PostalAddress",
          ...(event.venueAddress ? { streetAddress: event.venueAddress } : {}),
          addressLocality: event.city,
          addressRegion: "Tamil Nadu",
          addressCountry: "IN",
        },
      };

  const paidPrice = event.priceType === "paid" ? numericInrPrice(event.priceNote) : null;
  const offers =
    event.priceType === "free" || paidPrice
      ? {
          "@type": "Offer",
          url: event.primarySourceUrl,
          price: event.priceType === "free" ? "0" : paidPrice,
          priceCurrency: "INR",
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${canonicalUrl}#event`,
    url: canonicalUrl,
    name: event.title,
    description: eventSeoDescription(event),
    // A generic scene/stock image is not an official image of this event.
    ...(event.posterImageUrl ? { image: [absoluteUrl(event.posterImageUrl)] } : {}),
    startDate: new Date(event.startAt).toISOString(),
    ...(event.endAt && Date.parse(event.endAt) >= Date.parse(event.startAt) ? { endDate: new Date(event.endAt).toISOString() } : {}),
    eventStatus: eventStatusUrl(event.status),
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location,
    ...(event.organizerName
      ? { organizer: { "@type": "Organization", name: event.organizerName } }
      : {}),
    ...(event.priceType ? { isAccessibleForFree: event.priceType === "free" } : {}),
    ...(offers ? { offers } : {}),
  };
}

export function eventBreadcrumbStructuredData(event: PublicEvent): Record<string, unknown> {
  const field = getFieldCardForCategory(event.category);
  const categoryPath = field ? `/category/${field.key}` : "/";
  const categoryName = field?.label ?? "Chennai tech events";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: categoryName, item: absoluteUrl(categoryPath) },
      { "@type": "ListItem", position: 3, name: event.title, item: absoluteUrl(eventPath(event)) },
    ],
  };
}

export function categoryStructuredData(card: FieldCard, events: PublicEvent[]): Record<string, unknown> {
  return eventListingStructuredData(categorySeoHeading(card), categorySeoDescription(card), `/category/${card.key}`, events);
}

/** Imported dining ratings are NOT SCENE booking reviews and must not be
 * syndicated as our own aggregateRating. The visible dining label is unchanged. */
export function venueStructuredData(venue: CatalogVenue): Record<string, unknown> {
  const url = absoluteUrl(venuePath(venue));
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#business`,
    url,
    name: venue.name,
    description: venueSeoDescription(venue),
    image: venue.photos.map((photo) => absoluteUrl(photo)),
    address: {
      "@type": "PostalAddress",
      ...(venue.address ? { streetAddress: venue.address } : {}),
      addressLocality: venue.area,
      addressRegion: "Tamil Nadu",
      addressCountry: "IN",
    },
    ...(venue.phone ? { telephone: venue.phone } : {}),
    ...(venue.mapUrl ? { hasMap: venue.mapUrl } : {}),
  };
}

export function venueBreadcrumbStructuredData(venue: CatalogVenue): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Venues", item: absoluteUrl("/venues") },
      { "@type": "ListItem", position: 3, name: venue.name, item: absoluteUrl(venuePath(venue)) },
    ],
  };
}

export function websiteStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: "A discovery layer for Chennai's professional and technology events.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "en-IN",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}

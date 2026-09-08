import type { PublicEvent, PublicEventDetail } from "@/lib/events";
import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import { posterFor, usableEventSummary } from "@/lib/client/sceneEvent";
import { getFieldCardForCategory, type FieldCard } from "@/lib/fieldCards";

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
  const summary = usableEventSummary(event);
  if (summary) return truncateSeoText(summary);

  const when = event.startAt
    ? `${formatSceneDate(event.startAt)}, ${formatSceneTime(event.startAt)} IST`
    : "date to be announced";
  const where = event.isOnline ? "online" : (event.venueName ?? event.city);
  return truncateSeoText(
    `${event.title} takes place ${when} at ${where}. View details and the original registration source on SCENE/044.`,
  );
}

export function categorySeoDescription(card: FieldCard): string {
  return truncateSeoText(
    `Discover upcoming ${card.label.toLowerCase()} events in Chennai, including meetups, workshops, conferences and networking opportunities. Updated by SCENE/044.`,
  );
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
  if (!event.startAt) return null;

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
          availability: "https://schema.org/InStock",
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${canonicalUrl}#event`,
    url: canonicalUrl,
    name: event.title,
    description: eventSeoDescription(event),
    image: [eventImageUrl(event)],
    startDate: new Date(event.startAt).toISOString(),
    ...(event.endAt ? { endDate: new Date(event.endAt).toISOString() } : {}),
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
  const url = absoluteUrl(`/category/${card.key}`);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: `${card.label} events in Chennai`,
    description: categorySeoDescription(card),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: events.length,
      itemListElement: events.map((event, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: event.title,
        url: absoluteUrl(eventPath(event)),
      })),
    },
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

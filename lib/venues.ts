export const VENUE_EVENT_TYPES = [
  "Tech meetup",
  "Workshop",
  "Professional gathering",
  "Wellness session",
  "Podcast recording",
  "Photoshoot",
  "Videography / ad shoot",
  "Other professional event",
  // From the approved venue design's booking form.
  "Networking event",
  "Product launch",
] as const;

export type VenueEventType = (typeof VENUE_EVENT_TYPES)[number];

export type VenueSpaceId = "first-floor" | "terrace" | "standard-table" | "small-table" | "korean-table";

export interface VenueSpace {
  id: VenueSpaceId;
  name: string;
  eyebrow: string;
  description: string;
  capacity: string;
  maxGuests: number;
  image: string;
  amenities: readonly string[];
  communityRate: number | null;
  productionRate: number | null;
  minimumFoodSpend: number | null;
}

export const TIME_CAFE = {
  slug: "time-cafe",
  name: "Time Cafe",
  area: "Nungambakkam",
  city: "Chennai",
  address: "1, Krishna Street, Valluvar Kottam High Road, Nungambakkam, Chennai 600034",
  summary:
    "A calm, design-led cafe with an event floor, open-air terrace, projector, and tables for small conversations.",
  caféRating: 4.4,
  caféRatingCount: 31,
  caféRatingUrl: "https://www.zomato.com/chennai/time-cafe-nungambakkam",
  phone: "+91 88078 10728",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Time+Cafe+1+Krishna+Street+Nungambakkam+Chennai",
  mapEmbedUrl:
    "https://www.google.com/maps?q=Time+Cafe,+1+Krishna+Street,+Nungambakkam,+Chennai&output=embed",
  photos: [
    "/venues/time-cafe/first-floor-wide.jpeg",
    "/venues/time-cafe/terrace.jpeg",
    "/venues/time-cafe/projector-event.jpeg",
    "/venues/time-cafe/first-floor.jpeg",
    "/venues/time-cafe/small-table.jpeg",
  ],
  /*
   * Organizer-facing claims, so every one of these must be confirmed with the
   * owner before it ships — an amenity someone plans a workshop around ("strong
   * wifi") is a promise, not marketing copy.
   */
  amenities: [
    "Strong wifi",
    "Projector",
    "Indoor seating",
    "Open-air terrace",
    "Food & beverages",
    "Power access",
    "Reception support",
  ],
  /*
   * Spaces, rates and house rules as set out in the approved venue design
   * (Figma Make). One rate per space: the design prices each space flat, so
   * community and production rates are equal.
   */
  spaces: [
    {
      id: "first-floor",
      name: "First-floor event space",
      eyebrow: "Best for meetups",
      description: "A flexible indoor floor for talks, workshops, recordings, and professional gatherings with full seating and projector setup.",
      capacity: "25–30 people",
      maxGuests: 30,
      image: "/venues/figma/spaces-f33c5.jpg",
      amenities: ["Projector", "Strong wifi", "Flexible tables", "Indoor", "Power access"],
      communityRate: 2000,
      productionRate: 2000,
      minimumFoodSpend: null,
    },
    {
      id: "korean-table",
      name: "Korean table",
      eyebrow: "Best for evenings",
      description: "A relaxed spot for focused work and quick team catch-ups with traditional low seating and warm wood craft.",
      capacity: "Up to 8 people",
      maxGuests: 8,
      image: "/venues/figma/spaces-86081.jpg",
      amenities: ["8 seats", "Low seating", "Cafe service"],
      communityRate: 1000,
      productionRate: 1000,
      minimumFoodSpend: null,
    },
    {
      id: "standard-table",
      name: "Conversation table",
      eyebrow: "For a small circle",
      description: "A dedicated table for mentoring, interviews, and focused small-group conversations with library bookshelf backdrop.",
      capacity: "Up to 4 people",
      maxGuests: 4,
      image: "/venues/figma/spaces-d5006.jpg",
      amenities: ["4 seats", "Cafe service", "Power nearby"],
      communityRate: 400,
      productionRate: 400,
      minimumFoodSpend: null,
    },
    {
      id: "terrace",
      name: "Open terrace · BBQ table",
      eyebrow: "Social gatherings",
      description: "A rooftop terrace with a built-in BBQ grill, string lights, and Chennai skyline views — best for sundowners and casual evening cookouts.",
      capacity: "Up to 16 people",
      maxGuests: 16,
      image: "/venues/figma/spaces-terrace_1.jpg",
      amenities: ["Open air", "BBQ grill", "String lights"],
      communityRate: 1500,
      productionRate: 1500,
      minimumFoodSpend: null,
    },
  ] satisfies VenueSpace[],
  policies: [
    "3-hour minimum booking.",
    "No open flame or fog machines indoors.",
    "Amplified music until 9:30 PM.",
    "Outside catering welcome (kitchen not included).",
    "Free cancellation up to 7 days before your event. Cancel within 7 days and the deposit is held as credit toward a future booking. No charge is taken until the host confirms.",
  ],
} as const;

export type VenueStatus = "live" | "coming-soon";

/**
 * Card-level view of a venue, used by the landing and search surfaces.
 *
 * Deliberately smaller than the full venue record above: a cafe being onboarded
 * has a name and an area long before it has photography, agreed room names or
 * signed-off rates, and the listing surfaces must render it from that alone.
 * `spaces` is empty and `coverImage` null until it goes live.
 */
export interface VenueListing {
  slug: string;
  name: string;
  area: string;
  city: string;
  status: VenueStatus;
  summary: string;
  coverImage: string | null;
  spaces: readonly VenueSpace[];
  amenities: readonly string[];
  /** The venue's own public dining rating, when it has one. Not an events
   *  rating — labelled as such wherever it is shown. */
  rating: number | null;
}

/**
 * Cafes signed up and being onboarded but not yet in the catalog as a
 * `coming-soon` row.
 *
 * A plain count rather than placeholder entries on purpose: naming a cafe
 * before its listing is verified would be inventing inventory. The venue
 * catalog (`lib/venueCatalog.ts`, database-backed) is the actual registry —
 * this only covers cafes still being onboarded off-catalog, added to whatever
 * count `listPublicVenues()` returns.
 */
export const VENUES_IN_ONBOARDING = 0;

/*
 * The pricing/capacity rules below take only the rooms, not a whole listing.
 *
 * They have to serve two shapes: the `VenueListing` card view above and the
 * richer catalog rows the curator edits in the database (lib/venueCatalog.ts).
 * Both have `spaces`, and that is all these rules ever needed.
 */
interface HasSpaces {
  spaces: readonly VenueSpace[];
}

/**
 * Lowest published community rate across a venue's spaces, or null when none of
 * them has a rate yet (Times Cafe's terrace is quote-only, so a venue can have
 * spaces and still have no cheapest rate).
 */
export function venueFromRate(venue: HasSpaces): number | null {
  const rates = venue.spaces
    .map((space) => space.communityRate)
    .filter((rate): rate is number => typeof rate === "number");
  return rates.length > 0 ? Math.min(...rates) : null;
}

/** Largest group any of the venue's spaces can seat. Null before rooms exist. */
export function venueMaxGuests(venue: HasSpaces): number | null {
  if (venue.spaces.length === 0) return null;
  return Math.max(...venue.spaces.map((space) => space.maxGuests));
}

/** True when the venue can seat the requested group in at least one space. */
export function venueFitsGroup(venue: HasSpaces, people: number): boolean {
  const capacity = venueMaxGuests(venue);
  return capacity === null ? false : capacity >= people;
}

export function isProductionEvent(eventType: string) {
  return eventType === "Photoshoot" || eventType === "Videography / ad shoot";
}

export function rateForSpace(space: VenueSpace, eventType: string): number | null {
  return isProductionEvent(eventType) ? space.productionRate : space.communityRate;
}

/**
 * SCENE's service fee, charged to the organizer on top of the space cost when
 * they pay. The host's payout is unaffected: it stays 90% of the space cost
 * (the host-side 10% SCENE fee), so this fee is SCENE's alone.
 */
export const ORGANIZER_SERVICE_FEE_RATE = 0.1;

export function serviceFee(spaceCost: number): number {
  return Math.round(spaceCost * ORGANIZER_SERVICE_FEE_RATE);
}

/** What the organizer actually pays: space cost plus the service fee. */
export function amountDue(spaceCost: number): number {
  return spaceCost + serviceFee(spaceCost);
}

export function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function venueSearchHref(values: {
  location?: string;
  date?: string;
  time?: string;
  people?: string | number;
  eventType?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) params.set(key, String(value));
  });
  return `/venues/search${params.size ? `?${params.toString()}` : ""}`;
}

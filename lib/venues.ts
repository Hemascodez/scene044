export const VENUE_EVENT_TYPES = [
  "Tech meetup",
  "Workshop",
  "Professional gathering",
  "Wellness session",
  "Podcast recording",
  "Photoshoot",
  "Videography / ad shoot",
  "Other professional event",
] as const;

export type VenueEventType = (typeof VENUE_EVENT_TYPES)[number];

export type VenueSpaceId = "first-floor" | "terrace" | "standard-table" | "small-table";

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
  spaces: [
    {
      id: "first-floor",
      name: "First-floor event space",
      eyebrow: "Best for meetups",
      description: "A flexible indoor floor for talks, workshops, recordings, and professional gatherings.",
      capacity: "25–30 people",
      maxGuests: 30,
      image: "/venues/time-cafe/first-floor-wide.jpeg",
      amenities: ["Projector", "Strong wifi", "Flexible tables", "Indoor", "Power access"],
      communityRate: 2000,
      productionRate: 1000,
      minimumFoodSpend: 10000,
    },
    {
      id: "terrace",
      name: "Open-air terrace",
      eyebrow: "Best for evenings",
      description: "A relaxed open terrace for circles, community conversations, and small social formats.",
      capacity: "25–30 people",
      maxGuests: 30,
      image: "/venues/time-cafe/terrace.jpeg",
      amenities: ["Open air", "Moveable tables", "Ambient lighting"],
      communityRate: null,
      productionRate: null,
      minimumFoodSpend: null,
    },
    {
      id: "standard-table",
      name: "Conversation table",
      eyebrow: "For a small circle",
      description: "A dedicated table for mentoring, interviews, and focused small-group conversations.",
      capacity: "Up to 4 people",
      maxGuests: 4,
      image: "/venues/time-cafe/small-table.jpeg",
      amenities: ["4 seats", "Cafe service", "Power nearby"],
      communityRate: 500,
      productionRate: 300,
      minimumFoodSpend: 3500,
    },
    {
      id: "small-table",
      name: "Small talk table",
      eyebrow: "For interviews",
      description: "A compact three-person setup for short talks, podcast pre-production, or 1:1 meetings.",
      capacity: "Up to 3 people",
      maxGuests: 3,
      image: "/venues/time-cafe/small-table.jpeg",
      amenities: ["3 seats", "Cafe service", "Quiet corner"],
      communityRate: 400,
      productionRate: 200,
      minimumFoodSpend: 3000,
    },
  ] satisfies VenueSpace[],
  policies: [
    "Full venue payment is due only after the host approves your request.",
    "Confirmed booking payments are non-refundable.",
    "Rescheduling can be requested up to 14 days before the event and depends on availability.",
    "The organizer is responsible for damage caused during the event.",
    "For crowded events, food is ordered and collected from reception; table service may not be available.",
    "Valet service is not available during crowded events.",
    "Outside food needs prior permission. Pets are not allowed.",
    "The first floor is used for events while the ground floor continues to operate as a cafe.",
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
 * The venue registry — the single source of truth for what exists.
 *
 * Adding a cafe is a data change, not a code change: append one entry with
 * `status: "coming-soon"` while it is being onboarded (it renders as a
 * non-bookable "Launching soon" card), then flip it to `"live"` with its spaces
 * and photos once the listing is verified.
 */
export const VENUES: readonly VenueListing[] = [
  {
    slug: TIME_CAFE.slug,
    name: TIME_CAFE.name,
    area: TIME_CAFE.area,
    city: TIME_CAFE.city,
    status: "live",
    summary: TIME_CAFE.summary,
    coverImage: TIME_CAFE.photos[0],
    spaces: TIME_CAFE.spaces,
    amenities: TIME_CAFE.amenities,
    rating: TIME_CAFE.caféRating,
  },
];

/**
 * Cafes signed up and being onboarded but not yet listed.
 *
 * A plain count rather than placeholder entries on purpose: naming a cafe before
 * its listing is verified would be inventing inventory, which is the exact
 * problem this redesign removes. The "coming-soon" rendering path is real and
 * tested — it activates the moment a genuine entry is appended to VENUES.
 */
export const VENUES_IN_ONBOARDING = 3;

export function getVenue(slug: string): VenueListing | undefined {
  return VENUES.find((venue) => venue.slug === slug);
}

export function liveVenues(): VenueListing[] {
  return VENUES.filter((venue) => venue.status === "live");
}

export function upcomingVenues(): VenueListing[] {
  return VENUES.filter((venue) => venue.status === "coming-soon");
}

/** Total cafes on the way: listed-but-unlaunched entries plus those still being
 *  onboarded off-registry. Drives the honest "N launching soon" copy. */
export function upcomingVenueCount(): number {
  return upcomingVenues().length + VENUES_IN_ONBOARDING;
}

/*
 * The pricing/capacity rules below take only the rooms, not a whole listing.
 *
 * They have to serve two shapes: the registry entries here and the richer rows
 * the curator edits in the database (lib/venueCatalog.ts). Both have `spaces`,
 * and that is all these rules ever needed.
 */
interface HasSpaces {
  spaces: readonly VenueSpace[];
}

/**
 * Lowest published community rate across a venue's spaces, or null when none of
 * them has a rate yet (Time Cafe's terrace is quote-only, so a venue can have
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

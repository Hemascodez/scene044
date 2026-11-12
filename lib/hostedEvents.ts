import type { PublicEventDetail } from "@/lib/events";

/**
 * Events SCENE hosts itself, where the event page takes the registration
 * and payment instead of linking out. The backend attaches `hosted` to the
 * event detail (see docs/hosted-event-backend-contract.md); everything here is
 * shape and display logic only.
 */

/** The server's view of whether registration is accepting people. */
export type RegistrationState = "open" | "sold_out" | "closed";

export interface HostedEventInfo {
  /** The organising community, e.g. "Chapter Lounge". */
  hostName: string;
  /** The person hosting on the day, e.g. "Sadhana". */
  hostPerson: string | null;
  /** Always from the server. The client never sends or derives an amount. */
  pricePaise: number;
  capacity: number;
  /** Paid and confirmed registrations. */
  registeredCount: number;
  registrationState: RegistrationState;
  /** Full About text, plain paragraphs separated by blank lines. */
  description: string;
  gallery: { src: string; alt: string }[];
  /** `highlight` (optional): words in `text` marked with a highlighter on the note. */
  quote: { text: string; by: string; highlight?: string } | null;
  /** Numbered groups of icon cards, laid out like the venue page's "What this space offers". */
  goodToKnow: GoodToKnowGroup[];
  /** Shown beside the terms, under "Refunds". */
  refundPolicy: string;
  /** Terms & conditions, in order, verbatim from the organiser. */
  terms: string[];
}

/** Icon keys the page knows how to draw (components/scene/hosted/HostedGoodToKnow.tsx). */
export type GoodToKnowIcon = "book" | "coffee" | "clock" | "qr" | "users" | "seating" | "sparkle" | "pin";

export interface GoodToKnowGroup {
  group: string;
  note: string;
  items: { icon: GoodToKnowIcon; text: string }[];
}

export type HostedEventDetail = PublicEventDetail & { hosted: HostedEventInfo };

/** Hosting is a booking format, not a topic: an Arts event can also be SCENE hosted. */
export function isSceneHostedEvent(event: {hostedPricePaise?:number|null}):boolean {
  return typeof event.hostedPricePaise === 'number' && Number.isSafeInteger(event.hostedPricePaise) && event.hostedPricePaise > 0;
}

export interface SeatSummary {
  state: RegistrationState | "ended";
  spotsLeft: number;
  label: string;
}

const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatRupees(paise: number): string {
  return `₹${rupees.format(Math.round(paise / 100))}`;
}

/**
 * What the registration card and hero badge say about seats. Ended wins over
 * everything; then the server's own state; a full house counts as sold out
 * even if the server hasn't flipped its state yet.
 */
export function seatSummary(
  hosted: HostedEventInfo,
  endAt: string | null,
  now: Date = new Date(),
  eventStatus?: string,
): SeatSummary {
  if (endAt && Date.parse(endAt) <= now.getTime()) {
    return { state: "ended", spotsLeft: 0, label: "This event has ended" };
  }
  const spotsLeft = Math.max(0, hosted.capacity - hosted.registeredCount);
  if (eventStatus === "cancelled") return { state: "closed", spotsLeft, label: "Event cancelled" };
  if (hosted.registrationState === "closed") {
    return { state: "closed", spotsLeft, label: "Registration closed" };
  }
  if (hosted.registrationState === "sold_out" || spotsLeft === 0) {
    return { state: "sold_out", spotsLeft: 0, label: "Sold out" };
  }
  return {
    state: "open",
    spotsLeft,
    label: spotsLeft === 1 ? "1 spot left" : `${spotsLeft} of ${hosted.capacity} spots left`,
  };
}

/** What the registration card's progress bar shows. */
export function seatProgress(hosted: HostedEventInfo): { booked: number; capacity: number; left: number; percent: number } {
  const capacity = Math.max(0, hosted.capacity);
  const booked = Math.min(capacity, Math.max(0, hosted.registeredCount));
  return {
    booked,
    capacity,
    left: capacity - booked,
    percent: capacity === 0 ? 0 : Math.round((booked / capacity) * 100),
  };
}

const CHAPTER_LOUNGE_DESCRIPTION = [
  "When was the last time you sat down with a book and forgot to check the time?",
  "Spend a slow Sunday morning at Chapter Lounge — a quiet little pause from the rush, with two uninterrupted hours to read something you’ve been meaning to read, surrounded by people doing the same.",
  "Bring whatever you’re currently reading — a novel, poetry collection, non-fiction, or your Kindle. Find a cosy spot, enjoy some refreshments, and read at your own pace.",
  "There’s space for little conversations too — a line you loved, a character you can’t stop thinking about, a book you’ve been wanting to recommend. Share if you feel like it, or simply keep turning pages. No assigned book. No reading goals. No pressure.",
  "Just books, good company, refreshments, and a slow Sunday morning spent well ✨",
  "Come for the reading. Stay for the little conversations in between 🤎",
].join("\n\n");

const PHOTOS = "/events/chapter-lounge";

/**
 * The first hosted event, as the backend is expected to return it. Used by the
 * dev preview page and the tests until the real endpoints exist. The category
 * is a placeholder: the hosted layout never shows it.
 */
export const CHAPTER_LOUNGE_FIXTURE: HostedEventDetail = {
  id: 9044,
  title: "Let's do more reading",
  summary: "A slow Sunday morning with your favourite book.",
  highlights: [],
  tags: [],
  isPromoted: false,
  registrationNote: null,
  category: "arts",
  startAt: "2026-11-22T05:30:00.000Z",
  endAt: "2026-11-22T07:30:00.000Z",
  isOnline: false,
  venueName: "Madras Adda",
  city: "Chennai",
  organizerName: "Chapter Lounge",
  posterImageUrl: `${PHOTOS}/poster.jpg`,
  priceType: "paid",
  priceNote: "₹299",
  primarySourceDomain: "scene044.in",
  otherSourceDomains: [],
  status: "live",
  discoveredAt: "2026-11-12T00:00:00.000Z",
  lastVerifiedAt: null,
  venueAddress: "Mylapore, Chennai",
  primarySourceUrl: "https://scene044.in",
  updatedAt: "2026-11-12T00:00:00.000Z",
  gist: "Two uninterrupted hours, just you and your book with a cup of tea and good company.",
  hosted: {
    hostName: "Chapter Lounge",
    hostPerson: "Sadhana",
    pricePaise: 29900,
    capacity: 15,
    registeredCount: 0,
    registrationState: "open",
    description: CHAPTER_LOUNGE_DESCRIPTION,
    // In flipbook page order (I–VII), as in the "Previous events book flip" design.
    gallery: [
      { src: `${PHOTOS}/last-time-2.jpg`, alt: "Stacks of books on the table beside the Chapter Shelf sign" },
      { src: `${PHOTOS}/last-time-1.jpg`, alt: "Readers from the last Chapter Lounge session gathered around the table at Madras Adda" },
      { src: `${PHOTOS}/last-time-5.jpg`, alt: "Readers holding up the books they brought" },
      { src: `${PHOTOS}/last-time-6.jpg`, alt: "More readers with their books, from Murakami to Agatha Christie" },
      { src: `${PHOTOS}/last-time-4.jpg`, alt: "Readers mid-conversation and lost in their books" },
      { src: `${PHOTOS}/last-time-7.jpg`, alt: "Group photo at the end of the session" },
      { src: `${PHOTOS}/last-time-3.jpg`, alt: "Handwritten sticky notes from readers about the session" },
    ],
    quote: {
      text: "It's warm to see people immerse themselves in books. Stories, conversations and some chai. Thank you Sadhana and Chapter Lounge for this beautiful Sunday morning.",
      by: "A reader from last time",
      highlight: "immerse themselves in books",
    },
    goodToKnow: [
      {
        group: "What to bring",
        note: "Your book, your pace",
        items: [
          { icon: "book", text: "Any book, poetry collection or your Kindle" },
          { icon: "sparkle", text: "No assigned book, no reading goals" },
        ],
      },
      {
        group: "What's included",
        note: "Refreshments and good company",
        items: [
          { icon: "coffee", text: "Refreshments through the morning" },
          { icon: "seating", text: "A cosy spot to read for two hours" },
          { icon: "users", text: "Little conversations, if you feel like it" },
        ],
      },
      {
        group: "Getting in",
        note: "Arrival and entry",
        items: [
          { icon: "clock", text: "Arrive 30 minutes early for a smooth entry" },
          { icon: "qr", text: "Show your QR ticket at the door" },
        ],
      },
    ],
    refundPolicy: "Tickets once booked cannot be exchanged or refunded.",
    terms: [
      "Tickets once booked cannot be exchanged or refunded.",
      "An internet handling fee per ticket may be levied. Please check the total amount payable before completing your payment.",
      "We recommend arriving at least 30 minutes prior to the event for a smooth and seamless entry.",
      "Unlawful resale (or attempted unlawful resale) of a ticket will result in the seizure or cancellation of the ticket without refund or other compensation.",
      "Persons suspected of carrying items that may be used offensively or dangerously, or of carrying out illegal activities within the event premises, may be subject to security checks.",
      "Rights of admission are reserved, even for valid ticket holders.",
      "Photography and videography may take place during the event for documentation, promotional and social media purposes. By purchasing a ticket and attending the event, you acknowledge and agree that you may appear in photographs or videos captured during the event and that Chapter Lounge may use such content on its social media and other promotional platforms.",
      "Chapter Lounge is a reading and community space. Attendees are requested not to use the event to promote or sell personal businesses, products, services, books, events, or other projects.",
      "Chapter Lounge and the venue are not responsible for the loss, theft, or damage of any personal belongings brought to the event.",
      "These Terms & Conditions are subject to change from time to time at the discretion of the organiser.",
    ],
  },
};

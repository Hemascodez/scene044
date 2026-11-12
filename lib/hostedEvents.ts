import type { PublicEventDetail } from "@/lib/events";

/**
 * Events SCENE/044 hosts itself, where the event page takes the registration
 * and payment instead of linking out. The backend attaches `hosted` to the
 * event detail (see docs/hosted-event-backend-contract.md); everything here is
 * shape and display logic only.
 */

/** The server's view of whether registration is accepting people. */
export type RegistrationState = "open" | "sold_out" | "closed";

export interface HostedEventInfo {
  hostName: string;
  /** Always from the server. The client never sends or derives an amount. */
  pricePaise: number;
  capacity: number;
  /** Paid and confirmed registrations. */
  registeredCount: number;
  registrationState: RegistrationState;
  /** Full About text, plain paragraphs separated by blank lines. */
  description: string;
  gallery: { src: string; alt: string }[];
  quote: { text: string; by: string } | null;
  goodToKnow: string[];
  refundPolicy: string;
}

export type HostedEventDetail = PublicEventDetail & { hosted: HostedEventInfo };

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
export function seatSummary(hosted: HostedEventInfo, endAt: string | null, now: Date = new Date()): SeatSummary {
  if (endAt && Date.parse(endAt) <= now.getTime()) {
    return { state: "ended", spotsLeft: 0, label: "This event has ended" };
  }
  const spotsLeft = Math.max(0, hosted.capacity - hosted.registeredCount);
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
  category: "marketing",
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
  gist: "Two unhurried hours to read whatever you're reading, with refreshments and good company.",
  hosted: {
    hostName: "Chapter Lounge",
    pricePaise: 29900,
    capacity: 20,
    registeredCount: 14,
    registrationState: "open",
    description: CHAPTER_LOUNGE_DESCRIPTION,
    gallery: [
      { src: `${PHOTOS}/last-time-1.jpg`, alt: "Readers from the last Chapter Lounge session gathered around the table at Madras Adda" },
      { src: `${PHOTOS}/last-time-2.jpg`, alt: "Stacks of books on the table beside the Chapter Shelf sign" },
      { src: `${PHOTOS}/last-time-3.jpg`, alt: "Handwritten sticky notes from readers about the session" },
      { src: `${PHOTOS}/last-time-4.jpg`, alt: "Readers mid-conversation and lost in their books" },
      { src: `${PHOTOS}/last-time-5.jpg`, alt: "Readers holding up the books they brought" },
      { src: `${PHOTOS}/last-time-6.jpg`, alt: "More readers with their books, from Murakami to Agatha Christie" },
      { src: `${PHOTOS}/last-time-7.jpg`, alt: "Group photo at the end of the session" },
    ],
    quote: {
      text: "Very calm and warm space, filled with bookish people with intense love for books.",
      by: "A reader from last time",
    },
    goodToKnow: [
      "Bring any book, poetry collection or your Kindle. There's no assigned reading.",
      "Refreshments are included.",
      "Doors open at 10:50 am. Reading starts at 11.",
    ],
    refundPolicy: "Can't make it? Message us on WhatsApp up to 24 hours before and we'll refund you.",
  },
};

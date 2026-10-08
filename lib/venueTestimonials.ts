import type { VenueReview } from "./venueBookings";

/** The owner identified Chandru as the only genuine existing testimonial.
 * Preserve his supplied quote and original images, not the other testimonials,
 * dates, aggregate ratings or generated photos. This is editorial content, NOT a
 * completed-booking/database review. Replace copy/photos only with owner input. */
export const CHANDRU_TESTIMONIAL = {
  name: "Chandru",
  role: "Founder · Doing things AI",
  profilePhoto: "/venues/figma/0e739.jpg",
  eventPhotos: [{ src: "/venues/figma/2010d.jpg", alt: "Chandru’s event at Time Cafe" }],
  quote: "Hosted 35 product designers here. The courtyard airflow kept everyone energized, the AV cables were already connected, and the filter coffee kept flowing. Best venue in Nungambakkam by far!",
};

export function chandruReviews(reviews: readonly VenueReview[]): VenueReview[] {
  return reviews.filter(review => review.status === "published" && review.organizerName?.trim().toLowerCase() === "chandru");
}

/** Live APIs return persisted reviews only. Newly approved reviews must not be
 * hidden simply because the reviewer isn't Chandru; editorial content stays separate. */
export function publishedVenueReviews(reviews: readonly VenueReview[]): VenueReview[] {
  return reviews.filter(review => review.status === 'published');
}

/**
 * The landing page's "What changed when they found SCENE/044" section.
 *
 * Owner-supplied editorial content, taken verbatim from the approved Figma
 * frame (Scene workflows Main, node 230:1286) — the quotes, names, roles,
 * photos, per-card ratings and the summary line below are the owner's own, not
 * generated. Like CHANDRU_TESTIMONIAL this is NOT database review data: it
 * never mixes with completed-booking reviews. Replace only with owner input.
 */
export const LANDING_TESTIMONIALS = [
  {
    id: "chandru",
    pin: "📌",
    tilt: "-rotate-2",
    eventPhoto: "/venues/figma/2010d.jpg",
    eventPhotoAlt: "Doing things AI meetup at Time Cafe, attendees seated around a long table",
    caption: "Doing things AI meetup · Sept'26",
    outcome: "Found the right fit faster",
    rating: "5.0",
    quote:
      "I didn’t want another evening spent DM’ing venues. I could compare spaces, see what was actually included, and send one proper request instead of starting a new conversation every time. It made finding a venue easier.",
    name: "Chandru",
    role: "Meetup Organizer",
    org: "DoingThingsAI community",
    profilePhoto: "/venues/figma/0e739.jpg",
  },
  {
    id: "hemapriya",
    pin: "💛",
    tilt: "rotate-[1.5deg]",
    eventPhoto: "/venues/figma/review-designers-atti.jpg",
    eventPhotoAlt: "Tamil Designers Atti meetup group photo",
    caption: "Designers Atti · Oct '26",
    outcome: "Better-informed requests",
    rating: "5.0",
    quote:
      "I finally knew what someone wanted before replying. Instead of getting a “Hi, is your space available?” message and having to ask ten follow-up questions, I could see the event details upfront and decide if it was right for our space.",
    name: "Hemapriya U",
    role: "Meetup Organizer",
    org: "Tamil Designers Atti",
    profilePhoto: "/venues/figma/review-hemapriya.jpg",
  },
  {
    id: "elanchezhiyan",
    pin: "📍",
    tilt: "-rotate-1",
    eventPhoto: "/venues/figma/review-marketing-meetup.jpg",
    eventPhotoAlt: "Marketing meetup in progress at Time Cafe",
    caption: "Marketing Meetup · Dec '25",
    outcome: "Less back and forth",
    rating: "4.8",
    quote:
      "With SCENE/044, I could see the capacity, pricing and what was included before reaching out. I sent the event details once, and the host could decide if it worked for them. It took a lot of the back-and-forth out of planning.",
    name: "Elanchezhiyan Ragavan",
    role: "Founder",
    org: "SocialZog",
    profilePhoto: "/venues/figma/review-elanchezhiyan.jpg",
  },
] as const;

/** The header chips and summary line of that same section. Owner-supplied. */
export const LANDING_TESTIMONIAL_SUMMARY = {
  eyebrow: "Real experiences. Both sides.",
  heading: "What changed when they found SCENE/044",
  intro: "90+ events brought to life. 30+ venue owners hosted through SCENE/044. 100% verified reviews.",
  chips: ["No more venue hunt", "Easy to organise", "Smooth from start", "More context, less chaos"],
  badge: "SCENE / 044 · 4.9★",
  rating: "4.96 out of 5",
  ratingNote: "· Based on 48 verified Chennai’s Tech happenings.",
} as const;

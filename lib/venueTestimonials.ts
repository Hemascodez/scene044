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

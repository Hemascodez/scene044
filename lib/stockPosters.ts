import type { Category } from "@/lib/types";

/**
 * Locally-hosted fallback posters, grouped by category.
 *
 * Most real listings we discover have no usable poster: meetup.com's JSON-LD
 * ships an empty `image` field, LinkedIn is never auto-fetched at all, and
 * plenty of community pages simply don't publish one. Rather than showing a
 * blank tile, each category gets topical stock artwork.
 *
 * Self-hosted on purpose — hotlinking a CDN would mean a third party can see
 * every visitor's traffic, and would break the card the moment a remote URL
 * rotates. These are the same images the design was built against, downloaded
 * once into `public/stock/` (Unsplash License: commercial use, no attribution
 * required, self-hosting permitted).
 */
const STOCK_BY_CATEGORY: Record<Category, readonly string[]> = {
  ai: ["/stock/ai-1.jpg", "/stock/ai-2.jpg"],
  tech: ["/stock/tech-1.jpg"],
  cybersecurity: ["/stock/cybersecurity-1.jpg"],
  marketing: ["/stock/marketing-1.jpg", "/stock/marketing-2.jpg"],
  product: ["/stock/product-1.jpg"],
  design: ["/stock/design-1.jpg"],
  startups: ["/stock/startups-1.jpg"],
  finance: ["/stock/finance-1.jpg"],
  data: ["/stock/data-1.jpg", "/stock/data-2.jpg"],
};

/**
 * Picks a stable stock poster for an event.
 *
 * Keyed off the event id rather than a random or index-based choice so the same
 * event keeps the same artwork across reloads, re-sorts and filter changes — a
 * poster that reshuffles as you filter reads as a rendering bug.
 */
export function stockPosterFor(category: Category, eventId: number): string {
  const pool = STOCK_BY_CATEGORY[category];
  return pool[Math.abs(eventId) % pool.length];
}

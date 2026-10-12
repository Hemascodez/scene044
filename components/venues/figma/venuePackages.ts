/* Booking options (hourly / half-day / full-day) for venues that sell them.
 *
 * FOR CODEX — this is a design-stage placeholder, deliberately in the UI layer.
 * The owner supplied these prices; the backend work is yours. To wire it up:
 *
 *   1. Store rates and packages per venue (a `venue_space_packages` table, or
 *      columns on venue_spaces), and return them on CatalogSpace.
 *   2. Have /api/venue-bookings accept a package id, recompute the price
 *      server-side from that record, and reject an unknown or stale one.
 *      Never trust the amount from the client.
 *   3. Delete this file and read the same shape from the catalog.
 *
 * Until then the figures below are shown to organisers but NOT what the server
 * records: the API prices a booking as `rateForSpace × hours` from
 * venue_spaces. Chennai Yoga Studio is 2000/hr in the database and 2200/hr
 * here, so the request total and the stored total disagree by design until
 * step 2 lands. Nothing is charged at request time, so no one is mischarged —
 * but this must not ship to organisers as-is. */

export interface BookingPackage {
  id: string
  /** Shown as the option name, e.g. "Half-day". */
  name: string
  /** Fixed length in hours. */
  hours: number
  /** What the organiser pays, in whole rupees. */
  price: number
  /** The same hours at the hourly rate, struck through to show the saving. */
  listPrice: number
}

export interface VenuePricing {
  /** Whole rupees per hour, used for the hourly option and list prices. */
  hourlyRate: number
  /** Shortest hourly booking this venue accepts. */
  minHours: number
  packages: BookingPackage[]
}

const PRICING: Record<string, VenuePricing> = {
  'chennai-yoga-studio': {
    hourlyRate: 2200,
    minHours: 2,
    packages: [
      { id: 'half-day', name: 'Half-day', hours: 4, price: 7700, listPrice: 8800 },
      { id: 'full-day', name: 'Full-day', hours: 8, price: 13200, listPrice: 17600 },
    ],
  },
}

export function venuePricing(slug: string): VenuePricing | null {
  return PRICING[slug] ?? null
}

/** The hourly option, kept in the same shape so the UI can map over one list. */
export const HOURLY_ID = 'hourly'

export function packageById(pricing: VenuePricing, id: string): BookingPackage | null {
  return pricing.packages.find((p) => p.id === id) ?? null
}

/** Total for the current choice, in whole rupees. */
export function packageTotal(pricing: VenuePricing, id: string, hours: number): number {
  const chosen = packageById(pricing, id)
  return chosen ? chosen.price : pricing.hourlyRate * hours
}

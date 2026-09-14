import Image from "next/image";
import Link from "next/link";
import {
  formatRupees,
  venueFromRate,
  venueMaxGuests,
  venueSearchHref,
  type VenueListing,
} from "@/lib/venues";
import { VenueIcon, VenueKicker } from "@/components/venues/VenueUi";

const CARD_SHELL =
  "venue-listing-card group relative overflow-hidden rounded-[24px] border border-venue-line bg-card";

/**
 * A venue in a list.
 *
 * Two variants, driven by `venue.status`: a live venue is a bookable card with a
 * real cheapest rate, and a cafe still being onboarded is a flat, non-bookable
 * "Launching soon" card. The upcoming variant exists so appending one entry to
 * the registry is all it takes to announce a new cafe.
 */
export function VenueCard({
  venue,
  query = {},
  priority = false,
}: {
  venue: VenueListing;
  query?: Record<string, string | undefined>;
  priority?: boolean;
}) {
  if (venue.status === "coming-soon") return <UpcomingVenueCard venue={venue} />;

  const href = `/venues/${venue.slug}${venueSearchHref(query).replace("/venues/search", "")}`;
  const fromRate = venueFromRate(venue);
  const capacity = venueMaxGuests(venue);
  const chips = [
    capacity ? `Up to ${capacity} people` : null,
    ...venue.amenities.slice(0, 2),
  ].filter((chip): chip is string => !!chip);

  return (
    <article
      className={`${CARD_SHELL} transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(20,19,13,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {venue.coverImage && (
          <Image
            src={venue.coverImage}
            alt={`${venue.name} event space in ${venue.area}, ${venue.city}`}
            fill
            loading={priority ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 700px, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        <div className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] backdrop-blur">
          Visited &amp; verified
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <VenueKicker>
              {venue.area} · {venue.city}
            </VenueKicker>
            <h3 className="mt-1 font-display text-2xl font-black tracking-[-0.035em]">
              <Link
                href={href}
                className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {venue.name}
              </Link>
            </h3>
          </div>
          {venue.rating !== null && (
            <div
              className="flex shrink-0 items-center gap-1 text-sm font-bold"
              title="The cafe's public dining rating, not an events rating"
            >
              <VenueIcon name="star" className="size-4 fill-current" /> {venue.rating}
            </div>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{venue.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((item) => (
            <span key={item} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
              {item}
            </span>
          ))}
        </div>
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-venue-line pt-4">
          <div>
            {/* Derived from the venue's own spaces. A hardcoded figure here drifted
                from the real rates and advertised a price that did not exist. */}
            <span className="text-xs text-muted-foreground">{fromRate === null ? "Pricing" : "From"}</span>
            <p className="font-display text-xl font-black">
              {fromRate === null ? (
                <span className="text-base">On request</span>
              ) : (
                <>
                  {formatRupees(fromRate)}{" "}
                  <span className="font-sans text-xs font-medium text-muted-foreground">/ hour</span>
                </>
              )}
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm font-bold text-primary-ink">
            View venue <VenueIcon name="arrow" className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

function UpcomingVenueCard({ venue }: { venue: VenueListing }) {
  return (
    <article className={`${CARD_SHELL} border-dashed bg-secondary/40`}>
      <div className="flex h-full flex-col justify-between gap-6 p-5 sm:p-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-warn-ink">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            Launching soon
          </span>
          <h3 className="mt-3 font-display text-2xl font-black tracking-[-0.035em]">{venue.name}</h3>
          <VenueKicker className="mt-1 block">
            {venue.area} · {venue.city}
          </VenueKicker>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{venue.summary}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          We&apos;re verifying photos, capacity, and pricing with the owner before this one opens for
          requests.
        </p>
      </div>
    </article>
  );
}

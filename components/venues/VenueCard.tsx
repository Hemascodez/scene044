import Image from "next/image";
import Link from "next/link";
import {
  formatRupees,
  venueFromRate,
  venueMaxGuests,
  venueSearchHref,
  type VenueListing,
} from "@/lib/venues";
import { VenueIcon, VenueKicker, venueButton } from "@/components/venues/VenueUi";

/**
 * A venue in a list.
 *
 * Two variants, driven by `venue.status`: a live venue is a bookable slip with a
 * real cheapest rate, and a cafe still being onboarded is a flat, dashed,
 * non-bookable "Launching soon" card. The upcoming variant exists so appending
 * one entry to the registry is all it takes to announce a new cafe.
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
  const chips = [capacity ? `Up to ${capacity} people` : null, ...venue.amenities.slice(0, 4)].filter(
    (chip): chip is string => !!chip,
  );

  return (
    <article className="venue-listing-card group relative grid overflow-hidden border-[1.5px] border-foreground bg-white shadow-hard transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-hard-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:grid-cols-[594fr_425fr]">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary lg:aspect-auto lg:min-h-[480px]">
        {venue.coverImage && (
          <Image
            src={venue.coverImage}
            alt={`${venue.name} event space in ${venue.area}, ${venue.city}`}
            fill
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            sizes="(min-width: 1024px) 700px, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        <p className="absolute left-4 top-4 bg-venue-paper/95 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
          Visited &amp; verified
        </p>
      </div>

      <div className="flex flex-col border-t-[1.5px] border-foreground p-6 md:p-8 lg:border-l-[1.5px] lg:border-t-0">
        <div className="space-y-1.5 text-sm text-muted-foreground">
          {venue.rating !== null && (
            <p className="flex items-center gap-1.5" title="The cafe's public dining rating, not an events rating">
              <VenueIcon name="star" className="size-4 fill-current text-primary" />
              <span className="font-semibold text-foreground">{venue.rating}</span> dining rating
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <VenueIcon name="map" className="size-4" /> {venue.area}, {venue.city}
          </p>
        </div>

        <h3 className="mt-6 font-display text-[32px] font-bold leading-tight">
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
          >
            {venue.name}
          </Link>
        </h3>
        <p className="mt-3 text-sm leading-[22.75px] text-muted-foreground">{venue.summary}</p>

        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Highlights">
          {chips.map((item) => (
            <li key={item} className="border border-venue-line bg-venue-paper px-2.5 py-1 text-xs text-foreground">
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
          {/* Derived from the venue's own spaces. A hardcoded figure here drifted
              from the real rates and advertised a price that did not exist. */}
          <div className="border-[1.5px] border-foreground bg-venue-paper px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{fromRate === null ? "Pricing" : "Starting from"}</p>
            <p className="font-display text-[28px] font-extrabold leading-none">
              {fromRate === null ? (
                <span className="text-lg">On request</span>
              ) : (
                <>
                  {formatRupees(fromRate)} <span className="font-sans text-sm font-normal text-muted-foreground">per hour</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <span className={`${venueButton.primary} pointer-events-none`}>
              Request reservation <VenueIcon name="arrow" className="size-4" />
            </span>
            <p className="flex items-center gap-1.5 text-xs text-signal-ink">
              <VenueIcon name="shield" className="size-3.5" /> Host replies within 48 hours
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function UpcomingVenueCard({ venue }: { venue: VenueListing }) {
  return (
    <article className="relative overflow-hidden border-[1.5px] border-dashed border-foreground bg-secondary/40">
      <div className="flex h-full flex-col justify-between gap-6 p-5 sm:p-6">
        <div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn-ink">
            <span className="size-1.5 bg-warn" aria-hidden />
            Launching soon
          </span>
          <h3 className="mt-3 font-display text-2xl font-bold">{venue.name}</h3>
          <VenueKicker className="mt-1 block">
            {venue.area} · {venue.city}
          </VenueKicker>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{venue.summary}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          We&apos;re verifying photos, capacity, and pricing with the owner before this one opens for requests.
        </p>
      </div>
    </article>
  );
}

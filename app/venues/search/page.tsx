import Link from "next/link";
import { VenueCard } from "@/components/venues/VenueCard";
import { VenueIcon, VenueKicker, venueButton } from "@/components/venues/VenueUi";
import { VenueSearchBar } from "@/components/venues/VenueSearchBar";
import {
  liveVenues,
  upcomingVenueCount,
  upcomingVenues,
  venueFitsGroup,
  venueMaxGuests,
} from "@/lib/venues";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VenueSearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = {
    location: first(params.location),
    date: first(params.date),
    time: first(params.time),
    people: first(params.people),
    eventType: first(params.eventType),
  };
  const hasDate = Boolean(query.date);

  /*
   * The group-size filter now actually filters.
   *
   * It previously collected a guest count and returned the same venue whatever
   * you typed, so asking for 50 people produced a 30-capacity result presented
   * as a match. A request we cannot seat is now an explicit, honest miss.
   */
  const requestedPeople = Number(query.people);
  const groupSize = Number.isFinite(requestedPeople) && requestedPeople > 0 ? requestedPeople : null;
  const live = liveVenues();
  const matches = groupSize === null ? live : live.filter((venue) => venueFitsGroup(venue, groupSize));
  const tooSmall = groupSize !== null && matches.length === 0 && live.length > 0;
  const largestCapacity = Math.max(0, ...live.map((venue) => venueMaxGuests(venue) ?? 0));
  const upcoming = upcomingVenues();
  const comingCount = upcomingVenueCount();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <VenueKicker>Venue search</VenueKicker>
      <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.055em] sm:text-5xl">
        Spaces near {query.location || "Chennai"}
      </h1>
      <div className="mt-7">
        <VenueSearchBar defaults={query} compact />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-venue-line pb-5">
        {/* Counts come from the registry, so they stay true as cafes launch. */}
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">
            {matches.length} {matches.length === 1 ? "venue" : "venues"} available
          </strong>
          {comingCount > 0 && ` · ${comingCount} more launching soon`}
          {" · Request-based availability"}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            query.eventType,
            groupSize ? `${groupSize} people` : undefined,
            hasDate ? "Date selected" : "Any date",
          ]
            .filter(Boolean)
            .map((item) => (
              <span
                key={item}
                className="rounded-full border border-venue-line bg-card px-3 py-1.5 text-xs font-semibold"
              >
                {item}
              </span>
            ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {tooSmall ? (
            <div className="rounded-[22px] border border-dashed border-warn-ink/40 bg-warn/5 p-6">
              <p className="font-display text-xl font-black">
                Nothing this size yet — our largest space seats {largestCapacity}.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                You asked for {groupSize} people. Larger venues are being onboarded now. Try a smaller
                group, or tell us what you need and we&apos;ll look for a fit.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/venues/search" className={venueButton.outline}>
                  Clear group size
                </Link>
                <Link href="/venues/partner" className={venueButton.outline}>
                  Suggest a venue <VenueIcon name="arrow" className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            matches.map((venue, index) => (
              <VenueCard key={venue.slug} venue={venue} query={query} priority={index === 0} />
            ))
          )}

          {upcoming.map((venue) => (
            <VenueCard key={venue.slug} venue={venue} />
          ))}

          {comingCount > upcoming.length && (
            <div className="rounded-[22px] border border-dashed border-venue-line p-6 text-center">
              <p className="font-display text-xl font-black">
                {comingCount - upcoming.length} more Chennai {comingCount - upcoming.length === 1 ? "cafe" : "cafes"} open
                for requests soon.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                We verify photos, capacity, and pricing with each owner before listing, so what you see
                here is what you get.
              </p>
            </div>
          )}
        </div>

        <aside className="h-fit overflow-hidden rounded-[24px] border border-venue-line bg-card lg:sticky lg:top-24">
          <div className="aspect-[4/3] bg-[#deddd2] p-6">
            <div className="relative h-full overflow-hidden rounded-[18px] border border-foreground/10 bg-[radial-gradient(circle_at_20%_30%,#fff_0_2px,transparent_3px),linear-gradient(135deg,#e8e7dd_25%,#d6ddd1_25%_50%,#e9e4d9_50%_75%,#d7dfd6_75%)] bg-[length:36px_36px,100%_100%]">
              <div className="absolute left-[48%] top-[44%] grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-white shadow-lg">
                <VenueIcon name="map" />
              </div>
              <span className="absolute bottom-3 left-3 rounded-full bg-card px-3 py-1.5 text-xs font-bold">
                {live[0]?.area ?? "Chennai"}
              </span>
            </div>
          </div>
          <div className="p-5">
            <p className="font-display text-xl font-black">Where you&apos;ll be</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Every listing shows its exact address and a map link on the venue page — before you send a
              request.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

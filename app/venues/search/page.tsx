import type { Metadata } from "next";
import Link from "next/link";
import { VenueIcon, VenueKicker, venueButton } from "@/components/venues/VenueUi";
import { VenueSearchBar } from "@/components/venues/VenueSearchBar";
import { ScrollToResultsOnSearch } from "@/components/venues/ScrollToResultsOnSearch";
import { VenueChrome } from "@/components/venues/figma/VenueChrome";
import { formatRupees, rateForSpace, venueMaxGuests, venueSearchHref } from "@/lib/venues";
import { listPublicVenues } from "@/lib/venueCatalog";
import { matchingSpaces, requestedCapacity, venueDetailSearchHref, venueSearchValues } from "@/lib/venueSearch";

export const metadata: Metadata = {
  title: "Search Chennai Event Spaces — SCENE/044",
  description: "Compare event spaces by capacity, location and hourly rates before sending a request.",
  alternates: { canonical: "/venues/search" },
};

export default async function VenueSearchPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = venueSearchValues(await searchParams);
  const capacity = requestedCapacity(query.people);
  const invalidCapacity = capacity !== null && !Number.isFinite(capacity);
  const live = (await listPublicVenues()).filter(venue => venue.status === "live");
  const matches = live.flatMap(venue => matchingSpaces(venue.spaces, query.people).map(space => ({ venue, space })));
  const largest = Math.max(0, ...live.map(venue => venueMaxGuests(venue) ?? 0));
  const mapVenue = matches[0]?.venue;

  return <VenueChrome>
    <div className="mx-auto max-w-7xl px-4 py-8 font-body sm:px-6 lg:px-8 lg:py-12">
      <VenueKicker>Find a space</VenueKicker>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-5xl">Spaces in {query.location || "Chennai"}</h1>
      <div className="mt-7"><VenueSearchBar defaults={query} compact /></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-foreground pb-5">
        <p className="text-sm text-muted-foreground"><strong className="text-foreground">{matches.length} {matches.length === 1 ? "space fits" : "spaces fit"}{capacity && !invalidCapacity ? ` your ${capacity} attendees` : " your search"}</strong></p>
        <div className="flex flex-wrap gap-2">{[query.eventType, query.date || "Any date", query.time].filter(Boolean).map(item =>
          <span key={item} className="border border-foreground bg-venue-card px-3 py-1.5 text-xs">{item}</span>)}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">These spaces fit the group size. Your date and time travel with your request; availability is confirmed by the host. Browsing does not make or charge a booking.</p>
      <ScrollToResultsOnSearch trigger={JSON.stringify(query)} targetId="venue-results" />
      <div id="venue-results" className={`mt-8 grid scroll-mt-24 gap-8 ${mapVenue ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="min-w-0 space-y-6">
          {matches.length === 0 && <section className="border-[1.5px] border-dashed border-warn-ink bg-warn/5 p-6" aria-label="Search results">
            <h2 className="font-display text-xl font-extrabold">{invalidCapacity ? "Enter a whole number of attendees" : capacity && largest ? `No space fits ${capacity} attendees` : "No bookable spaces right now"}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{invalidCapacity ? "Use a positive whole number to check the capacity." : largest ? `Time Cafe’s largest individual space fits ${largest} people. We won’t show a smaller space as a suitable match.` : "Please check back shortly."}</p>
            <Link href={venueSearchHref({ ...query, people: "" })} className={`${venueButton.outline} mt-4`}>Clear attendee filter</Link>
          </section>}
          {matches.map(({ venue, space }, index) => {
            const rate = rateForSpace(space, query.eventType);
            const href = venueDetailSearchHref(venue.slug, query, space.id);
            const mapUrl = venue.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address || `${venue.name}, ${venue.area}, ${venue.city}`)}`;
            return <article key={`${venue.slug}:${space.id}`} className="grid min-w-0 overflow-hidden border-[1.5px] border-foreground bg-white shadow-hard sm:grid-cols-[220px_minmax(0,1fr)]">
              <Link href={href} aria-label={`View details of ${space.name} at ${venue.name}`} className="block min-h-44 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary-ink">
                <img src={space.image} alt={space.name} loading={index === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
              </Link>
              <div className="min-w-0 p-5">
                <p className="text-xs text-muted-foreground">{venue.name} · {venue.area}</p>
                <h2 className="mt-2 font-display text-xl font-extrabold"><Link href={href} className="underline-offset-4 hover:underline">{space.name}</Link></h2>
                <p className="mt-2 font-bold text-ok-ink">Fits up to {space.maxGuests} people</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{space.description}</p>
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"><VenueIcon name="map" className="size-4" /> View location on Google Maps<span className="sr-only"> (opens in a new tab)</span></a>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-venue-line pt-4">
                  <p className="text-sm"><strong className="text-xl">{rate === null ? "Host quote" : formatRupees(rate)}</strong>{rate !== null && " / hour"}<span className="mt-1 block text-xs text-muted-foreground">3-hour minimum · No added service fee</span></p>
                  <Link href={href} className={venueButton.primary}>View space details <VenueIcon name="arrow" className="size-4" /></Link>
                </div>
              </div>
            </article>;
          })}
        </div>
        {mapVenue && <aside className="h-fit min-w-0 border-[1.5px] border-foreground bg-venue-card shadow-hard lg:sticky lg:top-24">
          <iframe title={`Map of ${mapVenue.name}`} src={mapVenue.mapEmbedUrl || `https://www.google.com/maps?q=${encodeURIComponent(mapVenue.address || `${mapVenue.name}, ${mapVenue.area}`)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-60 w-full border-0" />
          <div className="p-5"><h2 className="font-display text-xl font-extrabold">Where you’ll be</h2><p className="mt-2 text-sm leading-6">{mapVenue.address || `${mapVenue.area}, ${mapVenue.city}`}</p></div>
        </aside>}
      </div>
    </div>
  </VenueChrome>;
}

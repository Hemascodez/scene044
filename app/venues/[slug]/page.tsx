import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venues/VenueDetail";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { aspectScores, listVenueReviews, summariseReviews } from "@/lib/venueBookings";

interface VenuePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getCatalogVenue(slug);
  if (!venue || venue.status === "hidden") return { title: "Venue — SCENE/044" };
  return {
    title: `${venue.name}, ${venue.area} — SCENE/044`,
    description: venue.summary || `Book ${venue.name} in ${venue.area}, Chennai for your next event.`,
  };
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const venue = await getCatalogVenue(slug);

  if (!venue || venue.status === "hidden") notFound();

  if (venue.status === "coming-soon") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary-ink">Launching soon</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.05em]">{venue.name}</h1>
        <p className="mt-3 text-base text-muted-foreground">{venue.area}, {venue.city} — not bookable yet.</p>
        <Link href="/venues/search" className="mt-6 inline-block font-bold underline underline-offset-4">
          See venues you can book today →
        </Link>
      </div>
    );
  }

  const reviews = await listVenueReviews(venue.slug);

  return (
    <VenueDetail
      venue={venue}
      reviews={reviews}
      reviewSummary={summariseReviews(reviews)}
      aspects={aspectScores(reviews)}
      initial={{
        date: first(query.date) ?? "",
        time: first(query.time) ?? "18:00",
        people: Math.max(1, Number(first(query.people) ?? 25) || 25),
        eventType: first(query.eventType) ?? "Tech meetup",
      }}
    />
  );
}

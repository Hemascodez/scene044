import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venues/VenueDetail";
import FigmaVenueDetail from "@/components/venues/figma/VenueDetail";
import { VenueChrome } from "@/components/venues/figma/VenueChrome";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { aspectScores, listVenueReviews, summariseReviews } from "@/lib/venueBookings";
import { venueSearchValues } from "@/lib/venueSearch";
import {
  absoluteUrl,
  serializeJsonLd,
  venueBreadcrumbStructuredData,
  venuePath,
  venueStructuredData,
} from "@/lib/seo";

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
  if (slug !== "time-cafe" || !venue || venue.status === "hidden") {
    return { title: "Venue — SCENE/044", robots: { index: false, follow: false } };
  }

  const title = `${venue.name}, ${venue.area} — SCENE/044`;
  const description = venue.summary || `Book ${venue.name} in ${venue.area}, Chennai for your next event.`;
  const path = venuePath(venue);
  const image = venue.photos[0];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [absoluteUrl(image)] } : {}),
    },
  };
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const venue = await getCatalogVenue(slug);

  if (slug !== "time-cafe" || !venue || venue.status === "hidden") notFound();

  if (venue.status === "coming-soon") {
    return (
      <VenueChrome>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-primary-ink">Launching soon</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.03em]">{venue.name}</h1>
        <p className="mt-3 text-base text-muted-foreground">{venue.area}, {venue.city} — not bookable yet.</p>
        <Link href="/venues/search" className="mt-6 inline-block font-bold underline underline-offset-4">
          See venues you can book today →
        </Link>
      </div>
      </VenueChrome>
    );
  }

  const jsonLdTimeCafe = [venueBreadcrumbStructuredData(venue), venueStructuredData(venue)];
  if (venue.slug === "time-cafe") {
    // The approved Figma Make design is specific to Time Cafe's photos, spaces
    // and content; other venues fall through to the generic venue page below.
    return (
      <>
        {jsonLdTimeCafe.map((data, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
        ))}
        <FigmaVenueDetail key={JSON.stringify(query)} venue={venue} publishedReviews={await listVenueReviews(venue.slug)}
          search={Object.keys(query).length ? venueSearchValues(query) : undefined} initialSpaceId={first(query.spaceId)} />
      </>
    );
  }

  const reviews = await listVenueReviews(venue.slug);
  const jsonLd = [venueBreadcrumbStructuredData(venue), venueStructuredData(venue)];

  return (
    <>
      {jsonLd.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
        />
      ))}
      <VenueChrome>
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
      </VenueChrome>
    </>
  );
}

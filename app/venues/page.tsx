import type { Metadata } from "next";
import Landing from "@/components/venues/figma/Landing";
import { listPublicVenues } from "@/lib/venueCatalog";
import { VENUES_SEARCH_DESCRIPTION, VENUES_SEARCH_TITLE } from "@/lib/venueDiscovery";
import { serializeJsonLd, venueCollectionStructuredData } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = VENUES_SEARCH_TITLE;
const DESCRIPTION = VENUES_SEARCH_DESCRIPTION;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/venues" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/venues", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/** Search-facing copy and structured data; the approved layout is retained. */
export default async function VenuesLandingPage() {
  const venues = await listPublicVenues();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(venueCollectionStructuredData(venues)) }} />
    <Landing venues={venues} />
  </>;
}

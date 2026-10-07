import type { Metadata } from "next";
import Landing from "@/components/venues/figma/Landing";
import { getCatalogVenue } from "@/lib/venueCatalog";

export const dynamic = "force-dynamic";

const TITLE = "Book Event Venues in Chennai — SCENE/044";
const DESCRIPTION =
  "Browse verified Chennai venues for meetups, workshops, podcasts and shoots. Real capacity and rates, request-based booking, pay only after the host approves.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/venues" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/venues", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/** The venue landing page — the approved Figma Make design, verbatim. */
export default async function VenuesLandingPage() {
  return <Landing venue={await getCatalogVenue("time-cafe")} />;
}

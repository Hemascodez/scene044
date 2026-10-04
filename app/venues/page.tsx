import type { Metadata } from "next";
import Landing from "@/components/venues/figma/Landing";

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
export default function VenuesLandingPage() {
  return <Landing />;
}

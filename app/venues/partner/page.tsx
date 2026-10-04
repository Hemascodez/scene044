import type { Metadata } from "next";
import VenuePartner from "@/components/venues/figma/VenuePartner";

export const metadata: Metadata = {
  title: "List your venue — SCENE/044",
  description: "List your cafe, studio, rooftop, or gathering space on SCENE/044. We verify photos, capacity, and pricing, and you approve every request before payment.",
  alternates: { canonical: "/venues/partner" },
};

/** "List your venue" — the approved Figma Make design, verbatim. */
export default function VenuePartnerPage() {
  return <VenuePartner />;
}

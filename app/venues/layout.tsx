import type { Metadata } from "next";
import type { ReactNode } from "react";
import { VenueShell } from "@/components/venues/VenueShell";
import { VENUES_SEARCH_DESCRIPTION, VENUES_SEARCH_TITLE } from "@/lib/venueDiscovery";

export const metadata: Metadata = {
  title: VENUES_SEARCH_TITLE,
  description: VENUES_SEARCH_DESCRIPTION,
};

/* Bare: the designed venue pages render their own header and footer. Pages
   without a design of their own (search, coming-soon) add <VenueChrome>. */
export default function VenuesLayout({ children }: { children: ReactNode }) {
  return <VenueShell bare>{children}</VenueShell>;
}

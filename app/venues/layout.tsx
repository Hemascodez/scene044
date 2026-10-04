import type { Metadata } from "next";
import type { ReactNode } from "react";
import { VenueShell } from "@/components/venues/VenueShell";

export const metadata: Metadata = {
  title: "Event Venues in Chennai — SCENE/044",
  description: "Find thoughtful Chennai venues for tech meetups, workshops, wellness sessions, podcasts, and shoots.",
};

/* Bare: the designed venue pages render their own header and footer. Pages
   without a design of their own (search, coming-soon) add <VenueChrome>. */
export default function VenuesLayout({ children }: { children: ReactNode }) {
  return <VenueShell bare>{children}</VenueShell>;
}

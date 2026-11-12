import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VenueShell } from "@/components/venues/VenueShell";
import DevMyBookings from "@/components/venues/figma/DevMyBookings";

/** Dev-only preview of My bookings with a hosted-event ticket. Never served in production. */
export const metadata: Metadata = {
  title: "My bookings preview — SCENE/044",
  robots: { index: false, follow: false },
};

export default function MyBookingsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <VenueShell bare>
      <DevMyBookings />
    </VenueShell>
  );
}

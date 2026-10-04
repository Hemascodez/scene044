import type { Metadata } from "next";
import { VenueShell } from "@/components/venues/VenueShell";
import MyBookingsPage from "@/components/venues/figma/MyBookingsPage";

export const metadata: Metadata = {
  title: "My venue bookings — SCENE/044",
  robots: { index: false, follow: false },
};

/** My bookings — the approved Figma Make design, on real booking data. */
export default function BookingsPage() {
  return (
    <VenueShell bare>
      <MyBookingsPage />
    </VenueShell>
  );
}

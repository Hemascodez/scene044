import type { Metadata } from "next";
import { VenueShell } from "@/components/venues/VenueShell";
import HostWorkspacePage from "@/components/venues/figma/HostWorkspacePage";
import { requireHostPageAccess } from '@/lib/venueHostPageAuth';

export const metadata: Metadata = {
  title: "Time Cafe host view — SCENE/044",
  robots: { index: false, follow: false },
};

/* Recheck membership per request, not only in the proxy. */
export const dynamic = "force-dynamic";

/** The host workspace — the approved Figma Make design, on real bookings. */
export default async function HostPage() {
  await requireHostPageAccess();
  return (
    <VenueShell bare>
      <HostWorkspacePage />
    </VenueShell>
  );
}

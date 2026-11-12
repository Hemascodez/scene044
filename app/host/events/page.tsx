import type { Metadata } from "next";
import { VenueShell } from "@/components/venues/VenueShell";
import EventHostWorkspace from "@/components/venues/figma/EventHostWorkspace";

export const metadata: Metadata = {
  title: "Event workspace — SCENE",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The organiser's event workspace. Access is enforced by the /api/host/events
 * endpoints and proxy (approved event-host numbers). Venue permissions remain
 * separate; event hosts never gain venue booking access from this page.
 */
export default function HostEventsPage() {
  return (
    <VenueShell bare>
      <EventHostWorkspace api="http" />
    </VenueShell>
  );
}

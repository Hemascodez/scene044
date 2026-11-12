import type { Metadata } from "next";
import { VenueShell } from "@/components/venues/VenueShell";
import EventHostWorkspace from "@/components/venues/figma/EventHostWorkspace";

export const metadata: Metadata = {
  title: "Event workspace — SCENE/044",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The organiser's event workspace. Access is enforced by the /api/host/events
 * endpoints (approved event-host numbers). Note: proxy.ts currently admits
 * only curators and venue hosts under /host — see
 * docs/hosted-event-backend-contract.md for the change the backend must make.
 */
export default function HostEventsPage() {
  return (
    <VenueShell bare>
      <EventHostWorkspace api="http" />
    </VenueShell>
  );
}

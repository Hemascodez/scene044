import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VenueShell } from "@/components/venues/VenueShell";
import EventHostWorkspace from "@/components/venues/figma/EventHostWorkspace";

/** Dev-only preview of the event workspace on sample data. Never served in production. */
export const metadata: Metadata = {
  title: "Event workspace preview — SCENE",
  robots: { index: false, follow: false },
};

export default function HostEventsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <VenueShell bare>
      <EventHostWorkspace api="mock" />
    </VenueShell>
  );
}

import type { Metadata } from "next";
import { VenueShell } from "@/components/venues/VenueShell";
import HostWorkspacePage from "@/components/venues/figma/HostWorkspacePage";

export const metadata: Metadata = {
  title: "Time Cafe host view — SCENE/044",
  robots: { index: false, follow: false },
};

/* Rendered per request (the workspace greets by the current IST hour). Access
   is still gated by the curator login in proxy.ts. */
export const dynamic = "force-dynamic";

/** The host workspace — the approved Figma Make design, on real bookings. */
export default function HostPage() {
  return (
    <VenueShell bare>
      <HostWorkspacePage />
    </VenueShell>
  );
}

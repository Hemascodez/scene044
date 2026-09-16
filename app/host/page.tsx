import type { Metadata } from "next";
import { HostDashboard } from "@/components/venues/HostDashboard";
import { VenueShell } from "@/components/venues/VenueShell";
import { VenueIcon, VenueKicker } from "@/components/venues/VenueUi";
import { getISTParts } from "@/lib/client/istTime";
import { TIME_CAFE } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Times Cafe host view — SCENE/044",
  robots: { index: false, follow: false },
};

/* Rendered per request so the greeting reflects the actual time. Statically
   rendered, it would freeze whatever hour the build ran at — which is how this
   page came to greet every host with "Good evening". */
export const dynamic = "force-dynamic";

/** Anchored to IST, not the visitor's clock: the host reading this is standing
 *  in the cafe in Chennai. */
function greeting(now: Date = new Date()): string {
  const { hour } = getISTParts(now);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HostPage() {
  return <VenueShell active="host"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><VenueKicker>Invite-only host workspace</VenueKicker><h1 className="mt-2 font-display text-4xl font-black tracking-[-0.055em] sm:text-5xl">{greeting()}, {TIME_CAFE.name}.</h1><p className="mt-3 text-sm text-muted-foreground">Approve good-fit events, protect your calendar, and see what you&apos;ll receive.</p></div><div className="flex items-center gap-3 rounded-2xl border border-foreground/15 bg-card px-4 py-3"><div className="grid size-10 place-items-center rounded-full bg-foreground text-background"><VenueIcon name="coffee" className="size-5" /></div><div><p className="text-sm font-bold">Times Cafe</p><p className="text-xs text-signal-ink">● Listing active</p></div></div></div><div className="mt-9"><HostDashboard /></div></div></VenueShell>;
}

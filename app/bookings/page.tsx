import type { Metadata } from "next";
import { BookingsClient } from "@/components/venues/BookingsClient";
import { VenueShell } from "@/components/venues/VenueShell";
import { VenueKicker } from "@/components/venues/VenueUi";

export const metadata: Metadata = {
  title: "My venue bookings — SCENE/044",
  robots: { index: false, follow: false },
};

export default function BookingsPage() {
  return <VenueShell active="bookings"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16"><VenueKicker>Organizer dashboard</VenueKicker><h1 className="mt-2 font-display text-4xl font-black tracking-[-0.055em] sm:text-5xl">My venue bookings</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Track host decisions, pay approved requests, and keep confirmed event details together.</p><div className="mt-9"><BookingsClient /></div></div></VenueShell>;
}

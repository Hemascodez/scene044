import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByCheckinToken } from "@/lib/venueBookings";
import { formatRupees } from "@/lib/venues";
import { CheckinPanel } from "@/components/venues/CheckinPanel";
import { VenueKicker } from "@/components/venues/VenueUi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check in a booking — SCENE/044",
  robots: { index: false, follow: false },
};

interface CheckinPageProps {
  params: Promise<{ token: string }>;
}

export default async function HostCheckinPage({ params }: CheckinPageProps) {
  const { token } = await params;
  const booking = await getBookingByCheckinToken(token);
  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <VenueKicker>Reception check-in</VenueKicker>
      <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.05em]">{booking.organizerName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">code <span className="font-mono">{booking.code}</span></p>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-foreground/15 bg-card">
        <div className="border-b border-foreground/12 p-5">
          <p className="font-display text-2xl font-black">{booking.venueName} · {booking.spaceName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{booking.eventDate} · {booking.startTime} · {booking.durationHours}h · {booking.people} people</p>
        </div>
        <div className="p-5">
          <p className="text-sm leading-6">{booking.description}</p>
          <p className="mt-3 text-sm font-bold">{booking.total === null ? "Host quote" : formatRupees(booking.total)}</p>
        </div>
      </div>

      <div className="mt-6">
        <CheckinPanel token={token} initialStatus={booking.status} />
      </div>
    </div>
  );
}

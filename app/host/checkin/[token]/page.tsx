import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByCheckinToken } from "@/lib/venueBookings";
import { formatRupees } from "@/lib/venues";
import { CheckinPanel } from "@/components/venues/CheckinPanel";
import { CheckinSession } from '@/components/venues/CheckinSession';
import { VenueKicker } from "@/components/venues/VenueUi";
import { VenueShell } from "@/components/venues/VenueShell";
import { requireHostPageAccess } from '@/lib/venueHostPageAuth';
import { canAccessHostBooking } from '@/lib/venueHostAccess';

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check in a booking — SCENE/044",
  robots: { index: false, follow: false },
};

interface CheckinPageProps {
  params: Promise<{ token: string }>;
}

export default async function HostCheckinPage({ params }: CheckinPageProps) {
  const request = await requireHostPageAccess();
  const { token } = await params;
  const booking = await getBookingByCheckinToken(token);
  if (!booking || !await canAccessHostBooking(request, booking.venueSlug)) notFound();

  return (
    <VenueShell active="host">
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <VenueKicker>Reception check-in</VenueKicker>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em]">{booking.organizerName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">code <span className="font-mono">{booking.code}</span></p>

      <div className="mt-6 overflow-hidden border-[1.5px] border-foreground bg-venue-card shadow-hard">
        <div className="border-b-[1.5px] border-foreground p-5">
          <p className="font-display text-2xl font-extrabold">{booking.venueName} · {booking.spaceName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{booking.eventDate} · {booking.startTime} · {booking.trialDurationMinutes ? '5-minute live trial' : `${booking.durationHours}h`} · {booking.people} people</p>
        </div>
        <div className="p-5">
          <p className="text-sm leading-6">{booking.description}</p>
          <p className="mt-3 text-sm font-bold">{booking.trialAmountPaise ? '₹10 live trial' : booking.total === null ? "Host quote" : formatRupees(booking.total)}</p>
        </div>
      </div>

      <div className="mt-6">
        <CheckinPanel token={token} initialStatus={booking.status} />
        {['checked_in','completed'].includes(booking.status) && <CheckinSession booking={booking} />}
      </div>
    </div>
    </VenueShell>
  );
}

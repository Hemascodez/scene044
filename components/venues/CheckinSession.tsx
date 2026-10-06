'use client';
import { useRouter } from 'next/navigation';
import type { VenueBooking } from '@/lib/venueBookings';
import { HostBookingSession } from './HostBookingSession';
export function CheckinSession({ booking }: { booking: VenueBooking }) {
  const router = useRouter();
  return <HostBookingSession booking={booking} onRefresh={() => router.refresh()} />;
}

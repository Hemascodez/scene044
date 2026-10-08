'use client';
import { useEffect, useState } from 'react';

/**
 * Formats the time left on a running booking.
 *
 * Hours and minutes while there is still time to plan around, switching to
 * minutes and seconds inside the last hour — that is the point where the
 * seconds are what the host is actually watching. (It used to read "144m 15s",
 * which nobody converts in their head mid-service.)
 */
export function formatRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m left`;
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s left`;
}

export function BookingCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const ended = remaining === 0;
  return (
    // role="timer" without aria-live: announcing every second would flood a screen reader.
    <p role="timer" className={`font-head text-3xl leading-none tabular-nums ${ended ? 'text-flame' : 'text-ink'}`}>
      {remaining === null ? 'Starting timer…' : ended ? 'Time is up' : formatRemaining(remaining)}
    </p>
  );
}

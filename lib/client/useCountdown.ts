"use client";

import { useEffect, useState } from "react";

/** Counts down to `endsAt`, ticking every second. Formats as "Xh Ym left",
 *  or "Time's up" once passed — used wherever a checked-in booking's timer
 *  needs to be visible (organizer's own view, host's dashboard). */
export function useCountdown(endsAt: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const remainingMs = new Date(endsAt).getTime() - now;
  if (remainingMs <= 0) return "Time's up";
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

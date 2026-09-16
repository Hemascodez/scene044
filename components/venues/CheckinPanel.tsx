"use client";

import { useState } from "react";
import { checkInBooking } from "@/lib/client/hostApi";
import type { VenueBookingStatus } from "@/lib/client/venueBookingStore";
import { venueButton } from "@/components/venues/VenueUi";

export function CheckinPanel({ token, initialStatus }: { token: string; initialStatus: VenueBookingStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function checkIn() {
    setBusy(true);
    setError("");
    try {
      const result = await checkInBooking({ token });
      setStatus(result.booking.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check in.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checked_in") {
    return <p className="rounded-2xl bg-signal/10 p-4 text-sm font-bold text-signal-ink">✓ Checked in — the timer has started.</p>;
  }
  if (status === "completed") {
    return <p className="rounded-2xl bg-muted p-4 text-sm font-bold text-muted-foreground">This event already finished.</p>;
  }
  if (status !== "confirmed") {
    return <p className="rounded-2xl bg-warn/10 p-4 text-sm text-warn-ink">This booking isn&apos;t paid and confirmed yet — nothing to check in.</p>;
  }

  return (
    <div>
      <button type="button" onClick={checkIn} disabled={busy} className={`${venueButton.primary} w-full disabled:opacity-60`}>
        {busy ? "Checking in…" : "Check in now"}
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-primary">{error}</p>}
    </div>
  );
}

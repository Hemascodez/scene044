'use client';
import { useEffect, useState } from 'react';
export function BookingCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    update(); const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return <p className="font-mono text-sm tabular-nums">{remaining === null ? 'Loading timer…' : remaining === 0 ? 'Booked time has ended' : `${Math.floor(remaining / 60)}m ${remaining % 60}s remaining`}</p>;
}

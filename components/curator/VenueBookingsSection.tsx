'use client';
import { useEffect, useState } from 'react';
import type { VenueBooking } from '@/lib/venueBookings';
import { HostBookingSession } from '@/components/venues/HostBookingSession';
type Row = VenueBooking & { foodTotalPaise: number; paymentId: string | null };
export function VenueBookingsSection() {
  const [bookings, setBookings] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('Loading bookings…');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/admin/venue-bookings?page=${page}`, { cache: 'no-store' });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (active) { setBookings(data.bookings); setCount(data.count); setMessage(''); }
      } catch (e) { if (active) setMessage(e instanceof Error ? e.message : 'Could not load bookings'); }
    };
    void load(); const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [page, revision]);
  const refresh = () => setRevision(n => n + 1);
  async function action(b: Row, trial: boolean) {
    if (trial && !window.confirm(`Mark ${b.code} as a real ₹10 payment trial with a five-minute check-in timer? Normal bookings are unchanged.`)) return;
    setBusy(true);
    try {
      const response = await fetch(trial ? `/api/admin/venue-bookings/${b.id}/trial` : `/api/host/bookings/${b.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Action failed'); } finally { setBusy(false); }
  }
  return <section className="space-y-4 p-4 sm:p-6 text-[#d8e5dd]">
    <h2 className="text-xl font-semibold">All venue bookings ({count})</h2>
    <p className="text-sm">Requests, payments, check-ins, completed and cancelled bookings. Refreshes every 15 seconds.</p>
    <button type="button" onClick={refresh} className="border px-4 py-2">Refresh</button>
    <p role="status" className="text-sm">{message}</p>
    {bookings.map(b => <article key={b.id} className="min-w-0 space-y-3 border border-[#325342] p-4">
      <h3 className="font-semibold break-words">{b.code} · {b.organizerName} · {b.status.replace('_', ' ')}</h3>
      <p className="text-sm break-words">{b.venueName} / {b.spaceName} · {b.eventDate} {b.startTime} · {b.organizerPhone}</p>
      <p className="text-sm">{b.eventType} · {b.people} people · Requested {new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p className="text-sm">{b.trialAmountPaise ? '₹10 live trial · 5 minutes' : b.total === null ? 'Host quote' : `Venue base: ₹${b.total}`} · Food tab: ₹{(b.foodTotalPaise / 100).toFixed(2)}</p>
      <p className="text-sm break-all">{b.paidAt ? `Paid ${new Date(b.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · ${b.paymentId ?? 'Legacy payment'}` : ['confirmed','checked_in','completed'].includes(b.status) ? 'Legacy confirmed booking; no captured-payment record' : 'Not paid'}</p>
      <div className="flex flex-wrap gap-3">
        {['requested','approved'].includes(b.status) && !b.trialAmountPaise && <button disabled={busy} className="border px-3 py-2 disabled:opacity-50" type="button" onClick={() => action(b, true)}>Prepare ₹10 / 5-minute trial</button>}
        {b.status === 'requested' && <button disabled={busy} className="border px-3 py-2 disabled:opacity-50" type="button" onClick={() => action(b, false)}>Approve request</button>}
      </div>
      {['checked_in','completed'].includes(b.status) && <details className="text-ink"><summary className="cursor-pointer text-[#d8e5dd]">Session & organiser&apos;s orders</summary><HostBookingSession booking={b} onRefresh={refresh} /></details>}
    </article>)}
    {!bookings.length && !message && <p>No bookings yet.</p>}
    <div className="flex flex-wrap items-center gap-4"><button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="border px-3 py-2 disabled:opacity-50">Previous</button><span>Page {page} / {Math.max(1, Math.ceil(count / 50))}</span><button disabled={page * 50 >= count} onClick={() => setPage(p => p + 1)} className="border px-3 py-2 disabled:opacity-50">Next</button></div>
  </section>;
}

'use client';
import { useEffect, useState } from 'react';
import { readCuratorBookingList, readCuratorBookingResponse, type CuratorBookingRow as Row } from '@/lib/client/curatorBookingResponse';
import { HostBookingSession } from '@/components/venues/HostBookingSession';
export function VenueBookingsSection() {
  const [bookings, setBookings] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/admin/venue-bookings?page=${page}&archived=${archived}`, { cache: 'no-store', signal: controller.signal });
        const data = await readCuratorBookingList(response);
        if (active) { setBookings(data.bookings); setCount(data.count); setError(''); }
      } catch (e) {
        if (active) setError(e instanceof TypeError ? 'Could not connect. Check your connection and retry.' : e instanceof Error ? e.message : 'Could not load bookings. Please retry.');
      } finally { inFlight = false; if (active) setLoading(false); }
    };
    void load(); const timer = setInterval(load, 15000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [page, revision, archived]);
  const refresh = () => { setLoading(true); setRevision(n => n + 1); };
  async function action(b: Row, trial: boolean) {
    if (trial && !window.confirm(`Mark ${b.code} as a real ₹10 payment trial with a five-minute check-in timer? Normal bookings are unchanged.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(trial ? `/api/admin/venue-bookings/${b.id}/trial` : `/api/host/bookings/${b.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) });
      const data = await readCuratorBookingResponse(response, 'Could not update this booking. Please retry.');
      if (data.ok !== true) throw new Error('Could not confirm the update. Refresh before trying again.');
      setMessage(trial ? `${b.code} is prepared for a ₹10 / five-minute trial.` : `${b.code} approved.`); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed. Please retry.'); } finally { setBusy(false); }
  }
  async function restore(b: Row) {
    if (!window.confirm(`Restore ${b.code} to organiser and host booking lists? Its previous status and payment history will be retained.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/venue-bookings/${b.id}/restore`, { method: 'POST' });
      const data = await readCuratorBookingResponse(response, 'Could not restore this booking. Please retry.');
      if (data.ok !== true) throw new Error('Could not confirm the restore. Refresh before trying again.');
      setMessage(`${b.code} restored.`); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed. Please retry.'); } finally { setBusy(false); }
  }
  return <section className="space-y-4 p-4 sm:p-6 text-[#d8e5dd]">
    <h2 className="text-xl font-semibold">All venue bookings{count === null ? '' : ` (${count})`}</h2>
    <p className="text-sm">Requests, payments, check-ins, completed and cancelled bookings. Refreshes every 15 seconds.</p>
    <button type="button" onClick={refresh} disabled={loading} className="border px-4 py-2 disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
    <label className="flex items-center gap-2"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); setPage(1); setBookings([]); setCount(null); setMessage(''); setError(''); setLoading(true); }} />Show archived history</label>
    <p role="status" className="text-sm">{message}</p>
    {error && <div role="alert" className="space-y-2 text-sm text-[#ff9a8a]"><p>{error}</p>{bookings.length > 0 && <p>Showing the last loaded bookings. Refresh to get the latest status.</p>}{error.includes('session expired') && <a href="/admin/login?next=%2Fadmin%2Fcurator%2Fvenues" className="inline-block underline">Sign in to curator</a>}</div>}
    {loading && <p role="status" className="text-sm">Loading bookings…</p>}
    {bookings.map(b => <article key={b.id} className="min-w-0 space-y-3 border border-[#325342] p-4">
      <h3 className="font-semibold break-words">{b.code} · {b.organizerName} · {b.status.replace('_', ' ')}</h3>
      {b.archivedAt && <p className="text-sm">Archived · {b.archiveReason}</p>}
      <p className="text-sm break-words">{b.venueName} / {b.spaceName} · {b.eventDate} {b.startTime} · {b.organizerPhone}</p>
      <p className="text-sm">{b.eventType} · {b.people} people · Requested {new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p className="text-sm">{b.trialAmountPaise ? '₹10 live trial · 5 minutes' : b.total === null ? 'Host quote' : `Venue base: ₹${b.total}`} · Food tab: ₹{(b.foodTotalPaise / 100).toFixed(2)}</p>
      <p className="text-sm break-all">{b.paidAt ? `Paid ${new Date(b.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · ${b.paymentId ?? 'Legacy payment'}` : ['confirmed','checked_in','completed'].includes(b.status) ? 'Legacy confirmed booking; no captured-payment record' : 'Not paid'}</p>
      <div className="flex flex-wrap gap-3">
        {!b.archivedAt && ['requested','approved'].includes(b.status) && !b.trialAmountPaise && <button disabled={busy} className="border px-3 py-2 disabled:opacity-50" type="button" onClick={() => action(b, true)}>Prepare ₹10 / 5-minute trial</button>}
        {!b.archivedAt && b.status === 'requested' && <button disabled={busy} className="border px-3 py-2 disabled:opacity-50" type="button" onClick={() => action(b, false)}>Approve request</button>}
        {b.archivedAt && <button disabled={busy} className="border px-3 py-2 disabled:opacity-50" type="button" onClick={() => restore(b)}>Restore booking</button>}
      </div>
      {['checked_in','completed'].includes(b.status) && <details className="text-ink"><summary className="cursor-pointer text-[#d8e5dd]">Session & organiser&apos;s orders</summary><HostBookingSession booking={b} onRefresh={refresh} /></details>}
    </article>)}
    {!bookings.length && !loading && !error && count !== null && <p>{archived ? 'No archived bookings.' : 'No bookings yet.'}</p>}
    {count !== null && <div className="flex flex-wrap items-center gap-4"><button disabled={page === 1 || loading} onClick={() => { setPage(p => p - 1); setBookings([]); setLoading(true); setError(''); }} className="border px-3 py-2 disabled:opacity-50">Previous</button><span>Page {page} / {Math.max(1, Math.ceil(count / 50))}</span><button disabled={page * 50 >= count || loading} onClick={() => { setPage(p => p + 1); setBookings([]); setLoading(true); setError(''); }} className="border px-3 py-2 disabled:opacity-50">Next</button></div>}
  </section>;
}

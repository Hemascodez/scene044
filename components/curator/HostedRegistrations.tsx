'use client';

import { useEffect, useState } from 'react';
import type { HostedRegistrationReport, RegistrationFilter } from '@/lib/hostedEventReporting';
import { AdminBtn, Field, Select, TextInput } from './adminUi';

const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
function when(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '—';
}
function statusLabel(status: string, paidAt: string | null) {
  if (['confirmed', 'checked_in'].includes(status) && !paidAt) return 'No payment recorded · needs review';
  return ({ confirmed: 'Paid · confirmed', checked_in: 'Paid · checked in', pending: 'Not paid', cancelled: 'Cancelled', payment_review: 'Payment needs review' })[status] ?? status;
}

/** Read-only reporting; there are deliberately no check-in, refund or send-message actions here. */
export function RegistrationReportDetails({ report }: { report: HostedRegistrationReport }) {
  const s = report.summary;
  const metrics = [
    ['Paid registrations', `${s.registeredCount} / ${report.event.capacity}`],
    ['Confirmed ticket revenue', money(s.grossPaise)],
    ['Not paid', String(s.activeUnpaidCount + s.expiredUnpaidCount)],
    ['Payment needs review', String(s.reviewCount)],
  ];
  return <>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(([label, value]) => <div key={label} className="min-w-0 border border-[#25382e] bg-[#0b1611] p-4"><dt className="text-sm text-[#a9bcb0]">{label}</dt><dd className="mt-2 break-words font-display text-2xl font-bold text-[#5effb0]">{value}</dd></div>)}
    </dl>
    <p className="text-sm leading-6 text-[#a9bcb0]">{s.checkoutCount} checkout records · {s.checkedInCount} checked in · {s.cancelledCount} cancelled · {s.waitlistCount} on waitlist.</p>
    <p className="text-sm leading-6 text-[#a9bcb0]">{money(s.sceneCollectedPaise)} collected by SCENE online · {money(s.hostCollectedPaise)} collected directly by the host. Host-collected payments are not due from SCENE.</p>
    <p className="text-sm leading-6 text-[#a9bcb0]">Unpaid: {s.activeUnpaidCount} active seat holds and {s.expiredUnpaidCount} expired holds. These are unfinished checkouts, not confirmed abandonment or page-visitor counts. Revenue is for paid, non-cancelled tickets; it is not a bank-settlement report.</p>
    {report.registrations.length === 0 ? <p className="border border-dashed border-[#33493c] p-5 text-sm text-[#a9bcb0]">No registrations match this view. Try another filter or clear the search.</p> : <div className="space-y-3">
      {report.registrations.map(r => <article key={r.id} className="min-w-0 space-y-3 border border-[#25382e] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words font-semibold">{r.name}</h3><span className={`border px-2 py-1 text-xs ${r.paidAt && (r.status === 'confirmed' || r.status === 'checked_in') ? 'border-[#2f7a52] text-[#5effb0]' : 'border-[#68502a] text-[#ffd48a]'}`}>{statusLabel(r.status, r.paidAt)}</span></div>
        <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[#a9bcb0]">Email</dt><dd className="mt-1 break-all select-text">{r.email || 'Not provided'}</dd></div>
          <div><dt className="text-[#a9bcb0]">Mobile</dt><dd className="mt-1 select-text">{r.phone ? `+${r.phone}` : 'Not provided'}</dd></div>
          <div><dt className="text-[#a9bcb0]">Payment source</dt><dd className="mt-1">{r.paymentSource === 'host_direct' ? 'Offline · paid directly to host' : 'Online · Razorpay'}</dd></div>
          <div><dt className="text-[#a9bcb0]">Ticket amount</dt><dd className="mt-1">{money(r.amountPaise)}{r.paidAt ? ' · paid' : ' · not confirmed paid'}</dd></div>
          <div><dt className="text-[#a9bcb0]">Started (IST)</dt><dd className="mt-1">{when(r.createdAt)}</dd></div>
          <div><dt className="text-[#a9bcb0]">Paid (IST)</dt><dd className="mt-1">{when(r.paidAt)}</dd></div>
          <div><dt className="text-[#a9bcb0]">Checked in (IST)</dt><dd className="mt-1">{when(r.checkedInAt)}</dd></div>
        </dl>
      </article>)}
    </div>}
  </>;
}

export function HostedRegistrations({ eventId, eventTitle, onCount }: { eventId: number; eventTitle: string; onCount?: (eventId: number, count: number) => void }) {
  const [filter, setFilter] = useState<RegistrationFilter>('paid');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; report: HostedRegistrationReport } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const key = JSON.stringify([eventId, filter, search.trim(), page]);
  const current = result?.key === key ? result.report : null;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight || !active) return;
      inFlight = true; setBusy(true); setError('');
      try {
        const params = new URLSearchParams({ filter, q: search.trim(), page: String(page) });
        const response = await fetch(`/api/admin/hosted-events/${eventId}/registrations?${params}`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not load registrations.');
        if (active) { setResult({ key, report: data }); onCount?.(eventId, data.summary.registeredCount); }
      } catch (e) { if (active && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load registrations.'); }
      finally { inFlight = false; if (active) setBusy(false); }
    }
    const initial = window.setTimeout(() => void load(), 250);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => { active = false; controller.abort(); window.clearTimeout(initial); window.clearInterval(interval); };
  }, [eventId, filter, search, page, refresh, key, onCount]);

  return <section aria-labelledby="curator-registrations" className="space-y-4 border border-[#33493c] p-4" aria-busy={busy}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="curator-registrations" className="font-display text-xl font-bold">Registrations &amp; attendees</h2><p className="mt-1 text-sm text-[#a9bcb0]">{eventTitle} · Private curator view · Updates every 30 seconds.</p></div><AdminBtn className="min-h-11" disabled={busy} onClick={() => setRefresh(n => n + 1)}>{busy ? 'Refreshing…' : 'Refresh registrations'}</AdminBtn></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Registration status"><Select className="min-h-11" value={filter} onChange={e => { setFilter(e.target.value as RegistrationFilter); setPage(1); }}><option value="paid">Paid registrations</option><option value="all">All registrations &amp; checkouts</option><option value="unpaid">Not paid</option><option value="checked_in">Checked in</option><option value="payment_review">Payment needs review</option><option value="cancelled">Cancelled</option></Select></Field><Field label="Search attendees"><TextInput className="min-h-11" maxLength={120} placeholder="Name, email or mobile" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></Field></div>
    {error && <p role="alert" className="border border-[#8a3630] p-3 text-sm text-[#ff9a8a]">{error}{current ? ' Showing the last successful update below.' : ' Please retry.'}</p>}
    {!current && !error && <p role="status" className="text-sm text-[#a9bcb0]">Loading registrations…</p>}
    {current && <><RegistrationReportDetails report={current} /><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#a9bcb0]"><p>{current.total} matching · Page {page} · Updated {when(current.fetchedAt)} IST</p><div className="flex gap-2"><AdminBtn className="min-h-11" disabled={busy || page === 1} onClick={() => setPage(n => Math.max(1, n - 1))}>Previous</AdminBtn><AdminBtn className="min-h-11" disabled={busy || page * current.pageSize >= current.total} onClick={() => setPage(n => n + 1)}>Next</AdminBtn></div></div></>}
  </section>;
}

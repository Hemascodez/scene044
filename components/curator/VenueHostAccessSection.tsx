'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApprovedHost, HostVenueOption } from '@/lib/venueHostAccess';
import { AdminBtn, Field, Pill, Select, TextInput } from './adminUi';

export function VenueHostAccessSection() {
  const [hosts, setHosts] = useState<ApprovedHost[]>([]);
  const [venues, setVenues] = useState<HostVenueOption[]>([]);
  const [venueSlug, setVenueSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const response = await fetch('/api/admin/venue-hosts', { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 401 ? 'Your curator session expired. Sign in again.' : 'Could not load host access. Please retry.');
    if (!Array.isArray(data?.hosts) || !Array.isArray(data?.venues)) throw new Error('Could not load host access. Please retry.');
    setHosts(data.hosts);
    setVenues(data.venues);
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/venue-hosts', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Could not load host access. Please retry.');
      const data = await response.json();
      if (!Array.isArray(data?.hosts) || !Array.isArray(data?.venues)) throw new Error('Could not load host access. Please retry.');
      if (active) { setHosts(data.hosts); setVenues(data.venues); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function mutate(path: string, method: string, body?: object, venueName?: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status === 401 ? 'Your curator session expired. Sign in again.' : data?.error ?? 'Could not change access. Please retry.');
      // Confirm the mutation even if the follow-up list request fails.
      setNotice(method === 'DELETE' ? 'Host access removed. Their account and bookings are preserved.' : `Number approved for ${venueName}. They must verify it with WhatsApp OTP to sign in.`);
      setRemoving(null);
      if (method === 'POST') { setPhone(''); setLabel(''); }
      try { await reload(); } catch { setError('Access was saved, but the list could not refresh. Retry loading the list.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change access. Please retry.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-6 p-4 lg:p-6">
    <div>
      <h1 className="font-display text-xl font-black">Host access</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9bcb0]">Approve a mobile number for a specific venue. They must verify their number on WhatsApp to sign in. Access is limited to that venue; removing it blocks existing host sessions too.</p>
    </div>
    <form className="max-w-xl space-y-4 border border-[#25382e] p-4" onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      if (!/^[6-9]\d{9}$/.test(phone)) { setPhoneError('Enter a valid 10-digit Indian mobile number.'); input.current?.focus(); return; }
      setPhoneError('');
      const selected = venues.find(venue => venue.slug === venueSlug);
      if (!selected) { setError('Choose a venue before approving this number.'); return; }
      void mutate('/api/admin/venue-hosts', 'POST', { phone, label, venueSlug }, selected.name);
    }}>
      <Field label="Approved mobile number" required>
        <TextInput ref={input} className="min-h-11" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={10} placeholder="10-digit number" aria-invalid={!!phoneError} aria-describedby={phoneError ? 'host-phone-error' : undefined} onChange={event => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }} required />
      </Field>
      {phoneError && <p id="host-phone-error" role="alert" className="text-sm text-[#ff9a8a]">{phoneError}</p>}
      <p className="text-sm text-[#a9bcb0]">Country code: +91</p>
      <Field label="Name / team member (optional)"><TextInput value={label} maxLength={120} onChange={event => setLabel(event.target.value)} /></Field>
      <Field label="Venue" required>
        <Select className="min-h-11" value={venueSlug} onChange={event => setVenueSlug(event.target.value)} required disabled={loading || busy}>
          <option value="">Choose a venue</option>
          {venues.map(venue => <option key={venue.slug} value={venue.slug}>{venue.name}</option>)}
        </Select>
      </Field>
      <AdminBtn className="min-h-11" type="submit" variant="primary" disabled={busy || loading || venues.length === 0}>{busy ? 'Saving…' : 'Approve number'}</AdminBtn>
    </form>
    {error && <div role="alert" className="space-y-2 text-sm text-[#ff9a8a]"><p>{error}</p><AdminBtn disabled={busy} onClick={() => { void reload().then(() => setError('')).catch(err => setError(err.message)); }}>Retry loading list</AdminBtn></div>}
    <p role="status" className="text-sm text-[#5effb0]">{notice}</p>
    {loading ? <p role="status">Loading approved numbers…</p> : hosts.length === 0 ? <p className="text-sm text-[#a9bcb0]">No approved numbers yet. Add a venue team member above.</p> : <ul className="max-w-2xl space-y-3">
      {hosts.map(host => <li key={host.id} className="flex flex-wrap items-center justify-between gap-4 border border-[#25382e] p-4">
        <div className="min-w-0"><p className="font-semibold">+91 {host.phone.slice(2)}</p><p className="break-words text-sm text-[#5effb0]">{host.venueName}</p>{host.label && <p className="break-words text-sm text-[#a9bcb0]">{host.label}</p>}</div>
        <Pill tone={host.revokedAt ? 'muted' : 'green'} glyph={host.revokedAt ? '−' : '✓'}>{host.revokedAt ? 'Access removed' : 'Approved'}</Pill>
        {host.revokedAt ? <AdminBtn disabled={busy} onClick={() => { void mutate('/api/admin/venue-hosts', 'POST', { phone: host.phone, label: host.label, venueSlug: host.venueSlug }, host.venueName); }}>Approve again</AdminBtn> : removing === host.id ? <div className="space-y-3 basis-full">
          <p className="text-sm">Remove {host.venueName} access for +91 {host.phone.slice(2)}? Bookings and payment history will stay saved.</p>
          <div className="flex gap-3"><AdminBtn variant="danger" disabled={busy} onClick={() => { void mutate(`/api/admin/venue-hosts/${host.id}`, 'DELETE'); }}>Confirm removal</AdminBtn><AdminBtn disabled={busy} onClick={() => setRemoving(null)}>Keep access</AdminBtn></div>
        </div> : <AdminBtn variant="danger" disabled={busy} onClick={() => setRemoving(host.id)}>Remove access</AdminBtn>}
      </li>)}
    </ul>}
  </section>;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApprovedHost } from '@/lib/venueHostAccess';
import { AdminBtn, Field, Pill, TextInput } from './adminUi';

export function VenueHostAccessSection() {
  const [hosts, setHosts] = useState<ApprovedHost[]>([]);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const response = await fetch('/api/admin/venue-hosts', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? 'Your curator session expired. Sign in again.' : 'Could not load host access. Please retry.');
    setHosts(data.hosts);
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/venue-hosts', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Could not load host access. Please retry.');
      const data = await response.json();
      if (active) setHosts(data.hosts);
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function mutate(path: string, method: string, body?: object) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not change access. Please retry.');
      // Confirm the mutation even if the follow-up list request fails.
      setNotice(method === 'DELETE' ? 'Host access removed. Their account and bookings are preserved.' : 'Number approved for Time Cafe. They must verify it with WhatsApp OTP to sign in.');
      setRemoving(null);
      if (method === 'POST') { setPhone(''); setLabel(''); }
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change access. Please retry.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-6 p-4 lg:p-6">
    <div>
      <h1 className="font-display text-xl font-black">Time Cafe · Host access</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9bcb0]">Only approved numbers can sign in as a Time Cafe host. Approval does not log anyone in—they must verify their number on WhatsApp. Removing access blocks existing host sessions too.</p>
    </div>
    <form className="max-w-xl space-y-4 border border-[#25382e] p-4" onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number.'); input.current?.focus(); return; }
      void mutate('/api/admin/venue-hosts', 'POST', { phone, label });
    }}>
      <Field label="Approved mobile number" required>
        <TextInput ref={input} type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={10} placeholder="10-digit number" onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} required />
      </Field>
      <p className="text-sm text-[#a9bcb0]">Country code: +91</p>
      <Field label="Name / team member (optional)"><TextInput value={label} maxLength={120} onChange={event => setLabel(event.target.value)} /></Field>
      <AdminBtn type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Approve number'}</AdminBtn>
    </form>
    {error && <div role="alert" className="space-y-2 text-sm text-[#ff9a8a]"><p>{error}</p><AdminBtn disabled={busy} onClick={() => { void reload().then(() => setError('')).catch(err => setError(err.message)); }}>Retry loading list</AdminBtn></div>}
    <p role="status" className="text-sm text-[#5effb0]">{notice}</p>
    {loading ? <p role="status">Loading approved numbers…</p> : hosts.length === 0 ? <p className="text-sm text-[#a9bcb0]">No approved numbers yet. Add a Time Cafe team member above.</p> : <ul className="max-w-2xl space-y-3">
      {hosts.map(host => <li key={host.id} className="flex flex-wrap items-center justify-between gap-4 border border-[#25382e] p-4">
        <div className="min-w-0"><p className="font-semibold">+91 {host.phone.slice(2)}</p>{host.label && <p className="break-words text-sm text-[#a9bcb0]">{host.label}</p>}</div>
        <Pill tone={host.revokedAt ? 'muted' : 'green'} glyph={host.revokedAt ? '−' : '✓'}>{host.revokedAt ? 'Access removed' : 'Approved'}</Pill>
        {host.revokedAt ? <AdminBtn disabled={busy} onClick={() => { void mutate('/api/admin/venue-hosts', 'POST', { phone: host.phone, label: host.label }); }}>Approve again</AdminBtn> : removing === host.id ? <div className="space-y-3 basis-full">
          <p className="text-sm">Remove host access for +91 {host.phone.slice(2)}? Bookings and payment history will stay saved.</p>
          <div className="flex gap-3"><AdminBtn variant="danger" disabled={busy} onClick={() => { void mutate(`/api/admin/venue-hosts/${host.id}`, 'DELETE'); }}>Confirm removal</AdminBtn><AdminBtn disabled={busy} onClick={() => setRemoving(null)}>Keep access</AdminBtn></div>
        </div> : <AdminBtn variant="danger" disabled={busy} onClick={() => setRemoving(host.id)}>Remove access</AdminBtn>}
      </li>)}
    </ul>}
  </section>;
}

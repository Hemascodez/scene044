'use client';
import { useEffect, useState } from 'react';
import { AdminBtn, AdminLink } from './adminUi';

interface Change { id: string; venueSlug: string; venueName: string; actorName: string; field: string; createdAt: string; readAt: string | null; }
export function VenueHostChanges({ active, onUnread, onNotify }: { active: boolean; onUnread: (count: number) => void; onNotify: (message: string) => void }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let newest: string | undefined;
    let busy = false;
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch('/api/admin/venue-changes', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load host changes.');
        if (cancelled) return;
        if (newest && data.changes[0]?.id !== newest && data.changes[0]?.readAt === null) onNotify(`${data.changes[0].venueName}: ${data.changes[0].field} updated by ${data.changes[0].actorName}.`);
        newest = data.changes[0]?.id ?? '0';
        setChanges(data.changes); onUnread(data.unread); setError('');
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load changes.'); }
      finally { busy = false; }
    }
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [onUnread, onNotify, revision]);
  if (!active) return null;
  return <section className="p-4 sm:p-6">
    <h1 className="text-xl font-bold">Host changes</h1>
    <p className="my-3 text-sm text-[#a9bcb0]">Saved venue and room photos are live immediately. This history stays here until you review it. Updates every 15 seconds.</p>
    {error && <p role="alert" className="my-3 text-[#ff9d89]">{error}</p>}
    <AdminBtn onClick={() => setRevision(value => value + 1)}>Refresh</AdminBtn>
    {!changes.length && !error && <p className="mt-5 text-[#a9bcb0]">No host changes yet.</p>}
    <ul className="mt-5 space-y-3">{changes.map(change => <li key={change.id} className="flex flex-wrap items-center justify-between gap-4 border border-[#25382e] p-4">
      <div className="min-w-0"><p className="font-bold">{!change.readAt && '● '}{change.venueName} · {change.field}</p><p className="mt-1 text-sm text-[#a9bcb0]">{change.actorName} · {new Date(change.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p></div>
      <div className="flex flex-wrap gap-2"><AdminLink href={`/venues/${encodeURIComponent(change.venueSlug)}`}>View live venue ↗</AdminLink>
      {!change.readAt && <AdminBtn onClick={async () => {
        try {
          const response = await fetch('/api/admin/venue-changes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [change.id] }) });
          if (!response.ok) throw new Error('Could not mark as read. Please retry.');
          setRevision(value => value + 1);
        } catch (e) { setError(e instanceof Error ? e.message : 'Please retry.'); }
      }}>Mark read</AdminBtn>}</div>
    </li>)}</ul>
  </section>;
}

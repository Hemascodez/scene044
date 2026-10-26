'use client';

import { useRef, useState } from 'react';
import type { AdminVenue } from '@/lib/client/venueAdminApi';
import { updateHostVenueDetails } from '@/lib/client/hostApi';
import { parseHostVenueDetails, type HostVenueDetails } from '@/lib/venueHostDetails';

const input = 'mt-1 min-h-11 w-full min-w-0 border-[1.5px] border-ink bg-white px-3 py-2 text-base';
const button = 'press min-h-11 border-[1.5px] border-ink px-4 py-2 text-sm font-semibold disabled:opacity-50';

export function HostVenueDetailsEditor({ venue, onSaved }: { venue: AdminVenue; onSaved: (venue: AdminVenue) => void }) {
  const [draft, setDraft] = useState<HostVenueDetails>({ name: venue.name, area: venue.area, city: venue.city,
    address: venue.address ?? '', summary: venue.summary, phone: venue.phone ?? '', mapUrl: venue.mapUrl ?? '',
    amenities: venue.amenities, policies: venue.policies });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const set = <K extends keyof HostVenueDetails>(key: K, value: HostVenueDetails[K]) => setDraft(d => ({ ...d, [key]: value }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const parsed = parseHostVenueDetails({ ...draft, amenities:draft.amenities.map(item => item.trim()).filter(Boolean), policies:draft.policies.map(item => item.trim()).filter(Boolean) });
    if (typeof parsed === 'string') { setError(parsed); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setBusy(true);
    try { onSaved((await updateHostVenueDetails(parsed)).venue); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not publish your details.'); }
    finally { setBusy(false); }
  }
  return <section className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
    <h2 className="font-head text-lg text-ink">Venue details & house policies</h2>
    <p className="mt-1 text-sm text-stone">Edit your public listing. Changes publish only when you save. Access, verified ratings and SCENE’s commission remain curator-managed.</p>
    <form onSubmit={save} className="mt-5 space-y-4">
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="border border-primary-ink p-3 text-primary-ink">{error}</p>}
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Public venue details</legend>
        {(['name','area','city','phone'] as const).map(key => <label key={key} className="block text-sm font-semibold">{({ name: 'Venue name', area: 'Area', city: 'City', phone: 'Contact phone' })[key]}<input required={key !== 'phone'} type={key === 'phone' ? 'tel' : 'text'} maxLength={key === 'phone' ? 40 : 150} value={draft[key]} onChange={e => set(key,e.target.value)} className={input} /></label>)}
        <label className="block text-sm font-semibold sm:col-span-2">Address<textarea rows={2} maxLength={1000} value={draft.address} onChange={e => set('address',e.target.value)} className={input} /></label>
        <label className="block text-sm font-semibold sm:col-span-2">Description<textarea rows={4} maxLength={2000} value={draft.summary} onChange={e => set('summary',e.target.value)} className={input} /></label>
        <label className="block text-sm font-semibold sm:col-span-2">Google Maps link<input type="url" maxLength={2048} value={draft.mapUrl} onChange={e => set('mapUrl',e.target.value)} className={input} /></label>
        {(['amenities','policies'] as const).map(key => <label key={key} className="block text-sm font-semibold sm:col-span-2">{key === 'amenities' ? 'Amenities' : 'House policies'} · one per line<textarea rows={5} value={draft[key].join('\n')} onChange={e => set(key,e.target.value.split('\n'))} className={input} /><span className="mt-1 block text-xs font-normal text-stone">{key === 'amenities' ? 'Only list facilities that are actually available.' : 'Include opening days, cancellations and setup rules.'}</span></label>)}
      </fieldset>
      <button disabled={busy} className={`${button} bg-flame text-white shadow-hard-sm`}>{busy ? 'Saving…' : 'Publish venue details'}</button>
    </form>
  </section>;
}

'use client';

import { useRef, useState } from 'react';
import type { AdminSpace } from '@/lib/client/venueAdminApi';
import { publishHostSpace, uploadHostVenuePhoto } from '@/lib/client/hostApi';
import { parseHostSpaceDetails, type HostSpaceDetails } from '@/lib/venueHostSpaceValidation';

const button = 'press min-h-11 border-[1.5px] border-ink px-4 py-2 text-sm font-semibold disabled:opacity-50';
const input = 'mt-1 w-full min-w-0 border-[1.5px] border-ink bg-white px-3 py-2 text-base';

/** A local draft and a read-only preview: only Publish writes the catalog. */
export function HostSpaceEditor({ space, onSaved, onCancel }: { space?: AdminSpace; onSaved: (space: AdminSpace) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<HostSpaceDetails>(() => ({ name: space?.name ?? '', eyebrow: space?.eyebrow ?? '',
    description: space?.description ?? '', maxGuests: space?.maxGuests ?? 1,
    communityRate: space?.communityRate ?? null, productionRate: space?.productionRate ?? null,
    photos: [...new Set([space?.image, ...(space?.photos ?? [])].filter((url): url is string => Boolean(url)))] }));
  const [requestId] = useState(() => typeof window !== 'undefined' ? crypto.randomUUID() : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const update = <K extends keyof HostSpaceDetails>(key: K, value: HostSpaceDetails[K]) => setDraft(d => ({ ...d, [key]: value }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError('');
    try {
      if (draft.photos.length + files.length > 30) throw new Error('Use up to 30 photos per space.');
      const urls = await Promise.all([...files].map(uploadHostVenuePhoto));
      setDraft(d => ({ ...d, photos: [...new Set([...d.photos, ...urls])] }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not upload photos.'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const details = parseHostSpaceDetails(draft);
    if (typeof details === 'string') { setError(details); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setBusy(true);
    try { const { space: saved } = await publishHostSpace(details, space?.rowId ?? requestId); onSaved(saved); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not publish. Your draft is still here.'); }
    finally { setBusy(false); }
  }
  function move(index: number, direction: number) {
    const photos = [...draft.photos], to = index + direction;
    if (to < 0 || to >= photos.length) return;
    [photos[index], photos[to]] = [photos[to], photos[index]];
    update('photos', photos); setPreviewIndex(0);
  }
  const photo = draft.photos[previewIndex] ?? draft.photos[0];
  return (
    <form onSubmit={publish} className="min-w-0 border-[1.5px] border-ink bg-paper p-4 sm:p-6">
      <h3 className="font-head text-xl">{space ? `Edit ${space.name}` : 'Add a bookable space'}</h3>
      <p className="mt-1 text-sm text-stone">Preview your changes here. Nothing changes on the venue page until you publish.</p>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 border border-primary-ink p-3 text-primary-ink">{error}</p>}
      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-2">
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <legend className="sr-only">Space details</legend>
          <label className="block text-sm font-semibold">Space name *<input required maxLength={120} value={draft.name} onChange={e => update('name', e.target.value)} className={input} /></label>
          <label className="block text-sm font-semibold">Card label <span className="font-normal">(optional)</span><input maxLength={80} value={draft.eyebrow} onChange={e => update('eyebrow', e.target.value)} className={input} placeholder="Best for meetups" /></label>
          <label className="block text-sm font-semibold">Description<textarea maxLength={2000} rows={3} value={draft.description} onChange={e => update('description', e.target.value)} className={input} /></label>
          <label className="block text-sm font-semibold">Maximum guests *<input required type="number" min={1} max={10000} step={1} value={draft.maxGuests || ''} onChange={e => update('maxGuests', Number(e.target.value))} className={input} /></label>
          <p className="text-sm text-stone">Hourly rates are the price organisers pay. SCENE’s 10% commission is deducted from the host payout, not added to the bill.</p>
          <label className="block text-sm font-semibold">Community rate · ₹ per hour<input type="number" min={1} max={1000000} step={1} value={draft.communityRate ?? ''} onChange={e => update('communityRate', e.target.value === '' ? null : Number(e.target.value))} className={input} /><span className="mt-1 block text-xs font-normal text-stone">Leave blank for rate on request.</span></label>
          <label className="block text-sm font-semibold">Production rate · ₹ per hour<input type="number" min={1} max={1000000} step={1} value={draft.productionRate ?? ''} onChange={e => update('productionRate', e.target.value === '' ? null : Number(e.target.value))} className={input} /><span className="mt-1 block text-xs font-normal text-stone">For photoshoots and video shoots. Leave blank for rate on request.</span></label>
          <button type="button" className={`${button} bg-white`} onClick={() => fileInput.current?.click()}>Add space photos</button>
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload space photos" className="sr-only" onChange={e => void upload(e.target.files)} />
          <p className="text-xs text-stone">At least one photo. First photo = cover. JPEG, PNG or WebP.</p>
          <ul className="space-y-2">{draft.photos.map((url, index) => <li key={url} className="flex flex-wrap items-center gap-2 border border-ink/20 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Space photo ${index + 1}`} className="size-12 object-cover" />
            <span className="text-sm">{index === 0 ? 'Cover' : `Photo ${index + 1}`}</span>
            <button type="button" className={button} disabled={index === 0} aria-label={`Move space photo ${index + 1} earlier`} onClick={() => move(index, -1)}>←</button>
            <button type="button" className={button} disabled={index === draft.photos.length - 1} aria-label={`Move space photo ${index + 1} later`} onClick={() => move(index, 1)}>→</button>
            <button type="button" className={`${button} text-primary-ink`} onClick={() => { update('photos', draft.photos.filter((_, i) => i !== index)); setPreviewIndex(0); }}>Remove</button>
          </li>)}</ul>
        </fieldset>
        <section aria-label="Space card preview" className="min-w-0 self-start">
          <p className="mb-3 font-mono-b text-xs uppercase tracking-wide">Preview · unpublished</p>
          <div className="overflow-hidden rounded-2xl border border-ink bg-ink text-white">
            <div className="relative aspect-[4/3] bg-ink/90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={photo} alt={draft.name || 'Space preview'} className="size-full object-cover" /> : <p className="grid size-full place-content-center text-sm">Add a space photo</p>}
              {draft.eyebrow && <span className="absolute left-3 top-3 bg-ink/80 px-3 py-2 text-xs font-semibold">{draft.eyebrow}</span>}
            </div>
            {draft.photos.length > 1 && <div className="flex flex-wrap justify-center gap-2 p-2">{draft.photos.map((_, i) => <button key={i} type="button" aria-label={`Preview photo ${i + 1}`} aria-pressed={previewIndex === i} onClick={() => setPreviewIndex(i)} className="min-h-11 min-w-11 rounded border border-white/40 text-sm">{i + 1}</button>)}</div>}
            <div className="space-y-2 p-4"><h4 className="font-head text-xl">{draft.name || 'Your space name'}</h4><p className="text-sm">Up to {draft.maxGuests || '—'} people · {draft.communityRate === null ? 'Rate on request' : `₹${draft.communityRate.toLocaleString('en-IN')} an hour`}</p><p className="text-sm leading-relaxed text-white/80">{draft.description || 'Your space description will appear here.'}</p></div>
          </div>
        </section>
      </div>
      <div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className={`${button} bg-flame text-white shadow-hard-sm`}>{busy ? 'Working…' : 'Publish space'}</button><button type="button" disabled={busy} onClick={onCancel} className={`${button} bg-white`}>Discard changes</button></div>
    </form>
  );
}

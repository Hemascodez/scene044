'use client';

import { useState } from 'react';

/** Keep the actual URL visible even when clipboard permissions are denied.
 * Never claim legacy execCommand succeeded: its return value is unreliable. */
export function VenueShare({ path, name = 'Your venue' }: { path: string; name?: string }) {
  const url = `https://scene044.in${path}`;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setMessage('Venue link copied.');
    } catch { setMessage('Automatic copying is blocked. Select the link below and copy it manually.'); }
    finally { setBusy(false); }
  }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: `${name} · SCENE/044`, url }); }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setMessage('Sharing is unavailable. Copy the venue link below.'); }
  }
  return <div className="w-full min-w-0 max-w-xl space-y-3 text-left">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void share()} className="press min-h-11 border-[1.5px] border-ink bg-flame px-4 py-2 text-sm font-semibold text-white shadow-hard-sm">Share venue</button>
      <button type="button" disabled={busy} onClick={() => void copy()} className="press min-h-11 border-[1.5px] border-ink bg-white px-4 py-2 text-sm font-semibold text-ink">{busy ? 'Copying…' : 'Copy link'}</button>
    </div>
    <label className="block text-sm font-semibold text-ink">Venue link<input readOnly value={url} onFocus={e => e.target.select()} className="mt-1 block min-h-11 w-full min-w-0 border border-ink bg-white px-3 py-2 text-sm font-normal text-ink" /></label>
    {message && <p role="status" className="text-sm text-ink">{message}</p>}
  </div>;
}

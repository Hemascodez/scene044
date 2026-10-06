'use client';
import { useEffect, useState } from 'react';
import type { MenuItem } from '@/lib/venueOperations';
type Draft = Omit<MenuItem, 'pricePaise'> & { price: string };
const field = 'min-w-0 w-full border border-ink bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-ink';
export function HostMenuPanel() {
  const [items, setItems] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading menu…');
  useEffect(() => {
    let active = true;
    fetch('/api/host/menu').then(async r => { if (!r.ok) throw new Error('Could not load menu'); return r.json(); }).then(data => {
      if (active) { setItems(data.items.map((i: MenuItem) => ({ ...i, price: String(i.pricePaise / 100) }))); setMessage(''); }
    }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, []);
  const edit = (id: string, changes: Partial<Draft>) => setItems(list => list.map(i => i.id === id ? { ...i, ...changes } : i));
  async function extract(file: File) {
    if (file.size > 5000000) { setMessage('Use a photo under 5 MB.'); return; }
    setBusy(true); setMessage('Reading your menu photo…');
    try {
      const form = new FormData(); form.append('photo', file);
      const response = await fetch('/api/host/menu/extract', { method: 'POST', body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      // Append instead of overwriting a host's saved menu or earlier photo.
      setItems(list => [...list, ...data.items.map((i: { name: string; category: string; priceRupees: number | null }) => ({ id: crypto.randomUUID(), name: i.name, category: i.category, price: i.priceRupees === null ? '' : String(i.priceRupees), available: true }))]);
      setMessage(`Draft extracted. Review names and prices, remove duplicates, then save. ${data.warnings.join(' ')}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not read photo'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (items.some(i => !i.name.trim() || !i.price.trim() || !Number.isFinite(Number(i.price)) || Number(i.price) < 0 || !/^\d+(\.\d{1,2})?$/.test(i.price))) { setMessage('Enter a name and valid INR price for every item (up to two decimals).'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/host/menu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(({ price, ...i }) => ({ ...i, pricePaise: Math.round(Number(price) * 100) })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage('Menu saved to Time Cafe. Available items can now be added to checked-in bookings.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-2 border-ink bg-white p-4 sm:p-6 shadow-hard">
    <h2 className="font-head text-xl">Time Cafe menu</h2>
    <p className="text-sm text-stone">Take a clear menu photo or upload one. AI creates a draft; you check it before saving. The photo is processed, not stored in your profile.</p>
    <label className="block text-sm font-semibold">Menu photo (JPG, PNG, WebP · under 5 MB)<input disabled={busy} className={`${field} mt-2`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const file = e.target.files?.[0]; if (file) void extract(file); e.target.value = ''; }} /></label>
    <div className="space-y-3">{items.map((i, index) => <div key={i.id} className="grid gap-2 border-t border-venue-line pt-3 sm:grid-cols-2">
      <label className="text-xs">Item {index + 1}<input disabled={busy} className={field} value={i.name} maxLength={150} onChange={e => edit(i.id, { name: e.target.value })} /></label>
      <label className="text-xs">Category<input disabled={busy} className={field} value={i.category} maxLength={80} onChange={e => edit(i.id, { category: e.target.value })} /></label>
      <label className="text-xs">Price (₹)<input disabled={busy} className={field} type="number" min="0" step="0.01" value={i.price} onChange={e => edit(i.id, { price: e.target.value })} /></label>
      <div className="flex flex-wrap items-center gap-4"><label className="text-sm"><input disabled={busy} type="checkbox" checked={i.available} onChange={e => edit(i.id, { available: e.target.checked })} /> Available</label><button disabled={busy} type="button" className="min-h-11 text-primary-ink underline" onClick={() => setItems(list => list.filter(x => x.id !== i.id))}>Remove item {index + 1}</button></div>
    </div>)}</div>
    <div className="flex flex-wrap gap-3"><button disabled={busy || items.length >= 200} type="button" className="border border-ink px-4 py-3" onClick={() => setItems(list => [...list, { id: crypto.randomUUID(), name: '', category: 'Menu', price: '', available: true }])}>Add item</button><button disabled={busy} type="button" className="border border-ink bg-ink text-white px-4 py-3 disabled:opacity-50" onClick={save}>{busy ? 'Working…' : 'Save menu'}</button></div>
    <p role="status" className="text-sm">{message}</p>
  </section>;
}

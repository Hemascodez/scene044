'use client';
import { useEffect, useState } from 'react';
import { completeHostBooking } from '@/lib/client/hostApi';
import type { VenueBooking, VenueBookingOrder } from '@/lib/venueBookings';
import type { MenuItem } from '@/lib/venueOperations';
import { BookingCountdown } from './BookingCountdown';
export function HostBookingSession({ booking, onRefresh }: { booking: VenueBooking; onRefresh: () => void }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<VenueBookingOrder[]>([]);
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [m, o] = await Promise.all([fetch('/api/host/menu'), fetch(`/api/host/bookings/${booking.id}/orders`)]);
        if (!m.ok || !o.ok) throw new Error('Could not load menu and booking orders');
        const [md, od] = await Promise.all([m.json(), o.json()]);
        if (active) { setMenu(md.items.filter((i: MenuItem) => i.available)); setOrders(od.orders); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load orders'); }
    };
    void load(); const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [booking.id]);
  const total = orders.reduce((sum, o) => sum + (o.unitPricePaise === null ? o.amount * 100 : o.unitPricePaise * o.quantity), 0);
  async function add() {
    if (!item || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) { setError('Select an item and quantity between 1 and 100.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/host/bookings/${booking.id}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ menuItemId: item, quantity, requestKey: crypto.randomUUID() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setOrders(list => [...list, data.order]); setQuantity(1); onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add order'); } finally { setBusy(false); }
  }
  async function finish() {
    if (!window.confirm('Finish this event now? The session will be marked completed. Food orders are recorded separately, not charged automatically.')) return;
    setBusy(true); setError('');
    try { await completeHostBooking(booking.id); onRefresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not complete booking'); }
    finally { setBusy(false); }
  }
  return <section className="min-w-0 space-y-4 border-2 border-ink bg-white p-4 shadow-hard">
    <h2 className="font-head text-lg break-words">{booking.organizerName} · {booking.code}</h2>
    <p className="text-sm">{booking.eventType} · {booking.spaceName}</p>
    {booking.trialDurationMinutes && <p className="text-sm font-semibold">Live trial · ₹10 venue payment · 5-minute session</p>}
    {!booking.archivedAt && booking.status === 'checked_in' && booking.endsAt && <BookingCountdown endsAt={booking.endsAt} />}
    <p className="text-xs">{booking.archivedAt ? 'Archived session history — read only.' : booking.status === 'checked_in' ? 'Event in progress. The timer persists across refreshes; it does not automatically end the event.' : 'Event completed.'}</p>
    <ul className="space-y-2 text-sm">{orders.map(o => <li key={o.id} className="flex justify-between gap-3"><span className="break-words">{o.quantity} × {o.description}</span><span className="shrink-0">₹{((o.unitPricePaise === null ? o.amount * 100 : o.unitPricePaise * o.quantity) / 100).toFixed(2)}</span></li>)}</ul>
    <p className="font-semibold">Food & drinks tab: ₹{(total / 100).toFixed(2)}</p>
    <p className="text-xs">Recorded against this organiser&apos;s booking. This tab is not an additional Razorpay charge.</p>
    {!booking.archivedAt && booking.status === 'checked_in' && <>
      {!menu.length ? <p className="text-sm">Save available menu items in Host profile first.</p> : <div className="grid gap-2 sm:grid-cols-[1fr_80px_auto]">
        <label className="min-w-0 text-xs">Menu item<select disabled={busy} className="w-full min-w-0 border border-ink p-2 text-sm" value={item} onChange={e => setItem(e.target.value)}><option value="">Select item</option>{menu.map(i => <option key={i.id} value={i.id}>{i.name} · ₹{(i.pricePaise / 100).toFixed(2)}</option>)}</select></label>
        <label className="text-xs">Quantity<input disabled={busy} className="w-full border border-ink p-2 text-sm" type="number" min="1" max="100" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label>
        <button disabled={busy} type="button" onClick={add} className="self-end border border-ink bg-ink p-2 text-white disabled:opacity-50">Add order</button>
      </div>}
      <button disabled={busy} type="button" onClick={finish} className="min-h-11 border border-ink px-4 py-2 disabled:opacity-50">Finish event</button>
    </>}
    {error && <p role="alert" className="text-sm text-primary-ink">{error}</p>}
  </section>;
}

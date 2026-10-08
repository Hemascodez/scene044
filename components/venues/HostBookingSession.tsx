'use client';
import { useEffect, useState } from 'react';
import { completeHostBooking } from '@/lib/client/hostApi';
import type { VenueBooking, VenueBookingOrder } from '@/lib/venueBookings';
import type { MenuItem } from '@/lib/venueOperations';
import { BookingCountdown } from './BookingCountdown';

/** Paise → ₹, showing paise only when there are any. */
function rupees(paise: number) {
  const whole = paise % 100 === 0;
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const orderPaise = (o: VenueBookingOrder) =>
  o.unitPricePaise === null ? o.amount * 100 : o.unitPricePaise * o.quantity;

/** "20:29" in IST, for the end of the booked slot. */
function endClock(endsAt: string) {
  return new Date(endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

const field = 'w-full min-w-0 border-[1.5px] border-ink bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-flame';
const label = 'font-mono-b text-[10px] uppercase tracking-[0.1em] text-stone';

/**
 * The live session panel: what the host looks at while an event is running.
 *
 * Presentation only — the menu/orders loading, the add-order call and the
 * complete call are unchanged.
 */
export function HostBookingSession({
  booking,
  onRefresh,
  onOpenProfile,
}: {
  booking: VenueBooking;
  onRefresh: () => void;
  /** Takes the host to the profile tab, where the menu is saved. */
  onOpenProfile?: () => void;
}) {
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
  const total = orders.reduce((sum, o) => sum + orderPaise(o), 0);
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

  const live = !booking.archivedAt && booking.status === 'checked_in';

  return (
    <section className="min-w-0 border-[1.5px] border-ink bg-white shadow-hard">
      {/* Header: dark while the event is running, so it reads as the live thing on the page. */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-ink px-5 py-4 ${live ? 'bg-ink text-paper-2' : 'bg-paper'}`}>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono-b text-[10px] uppercase tracking-[0.12em]">
            {live && <span aria-hidden="true" className="size-1.5 rounded-full bg-flame rf-beacon" />}
            {booking.archivedAt ? 'Archived session' : live ? 'Running now' : 'Event finished'}
          </p>
          <h2 className="mt-1 font-head text-lg break-words">{booking.organizerName}</h2>
          <p className={`mt-0.5 text-sm ${live ? 'text-paper-2/70' : 'text-stone'}`}>
            {booking.eventType} · {booking.spaceName}
          </p>
        </div>
        <p className={`shrink-0 font-mono-b text-xs tracking-[0.08em] ${live ? 'text-paper-2/70' : 'text-stone'}`}>{booking.code}</p>
      </div>

      <div className="space-y-5 p-5">
        {booking.trialDurationMinutes && (
          <p className="inline-flex border-[1.5px] border-ink bg-flame/10 px-2.5 py-1 font-mono-b text-[10px] uppercase tracking-[0.1em] text-primary-ink">
            Live trial · ₹10 venue payment · 5-minute session
          </p>
        )}

        {live && booking.endsAt ? (
          <div className="flex flex-wrap items-end justify-between gap-3 border-[1.5px] border-ink bg-paper px-4 py-3">
            <div>
              <p className={label}>Time left</p>
              <div className="mt-1"><BookingCountdown endsAt={booking.endsAt} /></div>
            </div>
            <p className="pb-1 font-mono text-xs text-stone">
              Booked until {endClock(booking.endsAt)} · the timer won&apos;t end the event for you
            </p>
          </div>
        ) : (
          <p className="text-sm text-stone">{booking.archivedAt ? 'Read-only history.' : 'This event has finished.'}</p>
        )}

        <div>
          <p className={label}>Food &amp; drinks tab</p>
          {orders.length > 0 && (
            <ul className="mt-2 divide-y divide-line border-[1.5px] border-ink">
              {orders.map(o => (
                <li key={o.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span className="break-words">{o.quantity} × {o.description}</span>
                  <span className="shrink-0 tabular-nums">{rupees(orderPaise(o))}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex items-baseline justify-between gap-3">
            <span className="font-head text-xl tabular-nums">{rupees(total)}</span>
            <span className="text-xs text-stone">Added to the organiser&apos;s bill at the cafe, not charged online.</span>
          </p>
        </div>

        {live && (
          <>
            {!menu.length ? (
              <p className="border-[1.5px] border-dashed border-ink/40 bg-paper px-4 py-3 text-sm text-stone">
                No menu items saved yet.{' '}
                {onOpenProfile ? (
                  <button type="button" onClick={onOpenProfile} className="font-body-sb text-ink underline underline-offset-4 hover:text-flame">
                    Add them in Host profile
                  </button>
                ) : (
                  <span className="font-body-sb text-ink">Add them in Host profile.</span>
                )}{' '}
                to start a tab.
              </p>
            ) : (
              <div className="grid gap-3 border-[1.5px] border-ink bg-paper p-4 sm:grid-cols-[1fr_96px_auto]">
                <label className="min-w-0">
                  <span className={label}>Menu item</span>
                  <select disabled={busy} className={`${field} mt-1.5`} value={item} onChange={e => setItem(e.target.value)}>
                    <option value="">Select item</option>
                    {menu.map(i => <option key={i.id} value={i.id}>{i.name} · {rupees(i.pricePaise)}</option>)}
                  </select>
                </label>
                <label>
                  <span className={label}>Qty</span>
                  <input disabled={busy} className={`${field} mt-1.5 tabular-nums`} type="number" min="1" max="100" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </label>
                <button disabled={busy} type="button" onClick={add} className="press self-end border-[1.5px] border-ink bg-ink px-4 py-2.5 font-mono-b text-xs uppercase tracking-[0.06em] text-white shadow-hard-sm disabled:opacity-50">
                  Add
                </button>
              </div>
            )}

            <button disabled={busy} type="button" onClick={finish} className="press min-h-11 w-full border-[1.5px] border-ink bg-flame px-4 py-3 font-mono-b text-xs uppercase tracking-[0.06em] text-white shadow-hard-sm disabled:opacity-50">
              {busy ? 'Working…' : 'Finish event'}
            </button>
          </>
        )}

        {error && <p role="alert" className="border-[1.5px] border-primary-ink bg-flame/10 px-3 py-2 text-sm font-semibold text-primary-ink">{error}</p>}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createManualVenueBlock, readManualVenueBlocks, type ManualVenueBlock } from "@/lib/client/venueBookingStore";
import { addHostOrder, checkInBooking, completeHostBooking, listHostBookings, setHostBookingStatus, type HostBooking } from "@/lib/client/hostApi";
import { useCountdown } from "@/lib/client/useCountdown";
import { formatRupees } from "@/lib/venues";
import { VenueIcon, VenueKicker, VenueStatus, venueButton } from "@/components/venues/VenueUi";

type HostTab = "requests" | "calendar" | "overview";

function readableDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+05:30`));
}

function OrderForm({ booking, onAdd }: { booking: HostBooking; onAdd: (description: string, amount: number) => Promise<void> }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Add a description and a valid amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd(description.trim(), Math.round(parsedAmount));
      setDescription("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl bg-secondary p-4">
      <label className="flex-1 basis-40 text-xs font-bold">Item<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="2x cold brew" className="mt-1.5 min-h-10 w-full rounded-lg border border-foreground/20 bg-[#fffef9] px-3 text-sm outline-none focus:border-primary" /></label>
      <label className="w-28 text-xs font-bold">Amount (₹)<input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="mt-1.5 min-h-10 w-full rounded-lg border border-foreground/20 bg-[#fffef9] px-3 text-sm outline-none focus:border-primary" /></label>
      <button type="submit" disabled={busy} className={`${venueButton.dark} min-h-10 px-4 text-xs disabled:opacity-50`}>{busy ? "Adding…" : "Add"}</button>
      {error && <p className="w-full text-xs font-semibold text-primary">{error}</p>}
      <p className="w-full text-xs text-muted-foreground">Running tab: {formatRupees(booking.orderTotal)}</p>
    </form>
  );
}

function RequestCard({
  booking,
  onDecide,
  onCheckIn,
  onComplete,
  onAddOrder,
}: {
  booking: HostBooking;
  onDecide: (id: number, status: "approved" | "declined") => void;
  onCheckIn: (token: string) => void;
  onComplete: (id: number) => void;
  onAddOrder: (id: number, description: string, amount: number) => Promise<void>;
}) {
  const countdown = useCountdown(booking.status === "checked_in" ? booking.endsAt : null);

  return (
    <article className="overflow-hidden rounded-[24px] border border-foreground/15 bg-card">
      <div className="flex flex-col gap-4 border-b border-foreground/12 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <div className="flex flex-wrap gap-2"><VenueKicker>{booking.eventType}</VenueKicker><VenueStatus status={booking.status} /></div>
          <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em]">{booking.organizerName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">wants {booking.spaceName} · code <span className="font-mono">{booking.code}</span></p>
        </div>
        <div className="rounded-2xl bg-secondary px-4 py-3">
          <p className="font-display text-xl font-black">{readableDate(booking.eventDate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{booking.startTime} · {booking.durationHours}h · {booking.people} people</p>
        </div>
      </div>

      <div className="grid gap-px bg-foreground/10 lg:grid-cols-[1.4fr_.8fr]">
        <div className="bg-card p-5 sm:p-6">
          <p className="text-xs font-bold text-muted-foreground">Event plan</p>
          <p className="mt-2 text-sm leading-6">{booking.description}</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Organizer contact</dt><dd className="mt-1 font-semibold">{booking.organizerEmail}<br />{booking.organizerPhone}</dd></div>
            {booking.trustUrl && <div><dt className="text-xs text-muted-foreground">Trust link</dt><dd className="mt-1"><a href={booking.trustUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">Open {booking.trustType}</a></dd></div>}
          </dl>
        </div>
        <div className="bg-[#f3f1e9] p-5 sm:p-6">
          <p className="text-xs text-muted-foreground">Organizer pays</p>
          <p className="mt-1 font-display text-2xl font-black">{booking.total === null ? "Your quote" : formatRupees(booking.total)}</p>
          {booking.total !== null && <>
            <div className="mt-4 flex justify-between border-t border-foreground/12 pt-3 text-sm"><span className="text-muted-foreground">SCENE fee · 10%</span><span>-{formatRupees(booking.total * 0.1)}</span></div>
            <div className="mt-2 flex justify-between text-sm font-bold"><span>You receive</span><span>{formatRupees(booking.total * 0.9)}</span></div>
          </>}
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <p className="max-w-lg text-xs leading-5 text-muted-foreground">
          {booking.status === "requested" && "Approving holds this slot for 24 hours while the organizer pays. Declining sends a clear unavailable status and never charges them."}
          {booking.status === "confirmed" && "Paid — scan the organizer's QR at reception, or check in with their code below."}
          {booking.status === "checked_in" && "Event is running. Add food or drinks to their tab as they order."}
          {booking.status === "completed" && "Event finished."}
        </p>
        {booking.status === "requested" && <div className="flex gap-2"><button type="button" onClick={() => onDecide(booking.id, "declined")} className={venueButton.outline}>Decline</button><button type="button" onClick={() => onDecide(booking.id, "approved")} className={venueButton.primary}>Approve request <VenueIcon name="check" className="size-4" /></button></div>}
        {booking.status === "confirmed" && <button type="button" onClick={() => onCheckIn(booking.checkinToken)} className={venueButton.primary}><VenueIcon name="check" className="size-4" /> Check in</button>}
        {booking.status === "checked_in" && (
          <div className="flex items-center gap-3">
            {countdown && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${countdown === "Time's up" ? "bg-warn/15 text-warn-ink" : "bg-signal/15 text-signal-ink"}`}>{countdown}</span>}
            <button type="button" onClick={() => onComplete(booking.id)} className={venueButton.outline}>Mark complete</button>
          </div>
        )}
      </div>

      {(booking.status === "checked_in" || booking.status === "completed") && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <OrderForm booking={booking} onAdd={(description, amount) => onAddOrder(booking.id, description, amount)} />
        </div>
      )}
    </article>
  );
}

export function HostDashboard() {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<HostTab>("requests");
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [blocks, setBlocks] = useState<ManualVenueBlock[]>([]);
  const [ready, setReady] = useState(false);
  const [blockSaved, setBlockSaved] = useState(false);
  const [checkinCode, setCheckinCode] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  const refresh = useCallback(() => {
    listHostBookings()
      .then((data) => setBookings(data.bookings))
      .catch(() => setBookings([]))
      .finally(() => setReady(true));
    setBlocks(readManualVenueBlocks());
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const activeBookings = bookings.filter((b) => !["declined", "cancelled", "expired"].includes(b.status));
  const confirmedLike = bookings.filter((b) => ["confirmed", "checked_in", "completed"].includes(b.status));
  const gross = confirmedLike.reduce((sum, b) => sum + (b.total ?? 0) + b.orderTotal, 0);
  const payout = Math.round(gross * 0.9);
  const pendingCount = bookings.filter((b) => b.status === "requested").length;
  const spaceDemand = useMemo(() => {
    const counts = new Map<string, number>();
    for (const booking of bookings) counts.set(booking.spaceName, (counts.get(booking.spaceName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [bookings]);
  const nextDates = useMemo(
    () => [...activeBookings, ...blocks].sort((a, b) => ("eventDate" in a ? a.eventDate : a.date).localeCompare("eventDate" in b ? b.eventDate : b.date)),
    [activeBookings, blocks],
  );

  async function decide(id: number, status: "approved" | "declined") {
    await setHostBookingStatus(id, status).catch(() => {});
    refresh();
  }

  async function doCheckIn(identifier: { token: string } | { code: string }) {
    setCheckinBusy(true);
    setCheckinError("");
    try {
      await checkInBooking(identifier);
      setCheckinCode("");
      refresh();
    } catch (err) {
      setCheckinError(err instanceof Error ? err.message : "Could not check in that booking.");
    } finally {
      setCheckinBusy(false);
    }
  }

  async function complete(id: number) {
    await completeHostBooking(id).catch(() => {});
    refresh();
  }

  async function addOrder(id: number, description: string, amount: number) {
    await addHostOrder(id, description, amount);
    refresh();
  }

  function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createManualVenueBlock({ date: String(data.get("date") ?? ""), from: String(data.get("from") ?? ""), to: String(data.get("to") ?? ""), spaceName: String(data.get("space") ?? ""), note: String(data.get("note") ?? "Manual booking") });
    event.currentTarget.reset();
    setBlockSaved(true);
    window.setTimeout(() => setBlockSaved(false), 2500);
    refresh();
  }

  if (!ready) return <div className="min-h-96 animate-pulse rounded-[24px] bg-card" />;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-foreground/15 bg-card p-5"><p className="text-xs text-muted-foreground">Needs your response</p><p className="mt-2 font-display text-4xl font-black">{pendingCount}</p><p className="mt-1 text-xs text-muted-foreground">Reply within 48 hours</p></div>
        <div className="rounded-[20px] border border-foreground/15 bg-card p-5"><p className="text-xs text-muted-foreground">Confirmed bookings</p><p className="mt-2 font-display text-4xl font-black">{confirmedLike.length}</p><p className="mt-1 text-xs text-muted-foreground">Across all spaces</p></div>
        <div className="rounded-[20px] bg-foreground p-5 text-background"><p className="text-xs text-background/55">Upcoming payout</p><p className="mt-2 font-display text-4xl font-black">{formatRupees(payout)}</p><p className="mt-1 text-xs text-background/55">After SCENE&apos;s 10% fee</p></div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-foreground/15 bg-card p-4">
        <label className="flex-1 basis-48 text-xs font-bold">Check in by code<input value={checkinCode} onChange={(e) => setCheckinCode(e.target.value.toUpperCase())} placeholder="SCN-XXXXXX" className="mt-1.5 min-h-10 w-full rounded-lg border border-foreground/20 bg-[#fffef9] px-3 text-sm font-mono outline-none focus:border-primary" /></label>
        <button type="button" disabled={checkinBusy || !checkinCode.trim()} onClick={() => doCheckIn({ code: checkinCode.trim() })} className={`${venueButton.primary} min-h-10 px-4 text-xs disabled:opacity-50`}>{checkinBusy ? "Checking in…" : "Check in"}</button>
        {checkinError && <p className="w-full text-xs font-semibold text-primary">{checkinError}</p>}
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-foreground/15" role="tablist" aria-label="Host dashboard sections">
        {([['requests',`Requests ${pendingCount ? `(${pendingCount})` : ""}`],['calendar','Calendar'],['overview','Payouts & insights']] as [HostTab,string][]).map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} onClick={()=>setTab(id)} className={`relative shrink-0 px-4 py-3 text-sm font-bold ${tab===id?"text-foreground":"text-muted-foreground hover:text-foreground"}`}>{label}{tab===id&&<motion.span layoutId="host-tab" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" transition={{type:"spring",stiffness:420,damping:34}} />}</button>)}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === "requests" && <motion.section key="requests" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="mt-6 space-y-5">
          {activeBookings.length === 0 && <div className="rounded-[24px] border border-dashed border-foreground/25 bg-card p-8 text-center text-sm text-muted-foreground">No venue requests yet. They&apos;ll show up here the moment someone books.</div>}
          {activeBookings.map((booking) => (
            <RequestCard key={booking.id} booking={booking} onDecide={decide} onCheckIn={(token) => doCheckIn({ token })} onComplete={complete} onAddOrder={addOrder} />
          ))}
        </motion.section>}

        {tab === "calendar" && <motion.section key="calendar" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]"><div className="overflow-hidden rounded-[24px] border border-foreground/15 bg-card"><div className="border-b border-foreground/12 p-5 sm:p-6"><VenueKicker>Availability</VenueKicker><h2 className="mt-1 font-display text-2xl font-black">Upcoming dates</h2></div><div className="divide-y divide-foreground/12">{nextDates.length?nextDates.map((item)=>{
          const isBooking = "eventDate" in item;
          const date = isBooking ? item.eventDate : item.date;
          const key = isBooking ? `booking-${item.id}` : `block-${item.id}`;
          return <div key={key} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-center font-mono text-[10px] font-bold uppercase">{readableDate(date).split(',')[0]}</div><div><p className="font-bold">{isBooking ? `${item.eventType} · ${item.spaceName}` : `Blocked · ${item.spaceName}`}</p><p className="mt-1 text-xs text-muted-foreground">{isBooking ? `${item.startTime} · ${item.durationHours}h` : `${item.from}–${item.to}`} · {isBooking ? item.organizerName : item.note}</p></div></div>{isBooking && <VenueStatus status={item.status} />}</div>;
        }):<div className="p-8 text-center text-sm text-muted-foreground">No requests or manual blocks yet.</div>}</div></div><form onSubmit={addBlock} className="h-fit rounded-[24px] border border-foreground/15 bg-card p-5 sm:p-6"><VenueKicker>Manual booking</VenueKicker><h2 className="mt-1 font-display text-2xl font-black">Block a slot</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use this for friends, private bookings, maintenance, or anything arranged outside SCENE.</p><label className="mt-5 block text-sm font-bold">Date<input required name="date" type="date" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-bold">From<input required name="from" type="time" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label><label className="text-sm font-bold">To<input required name="to" type="time" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label></div><label className="mt-4 block text-sm font-bold">Space<select name="space" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary"><option>First-floor event space</option><option>Open-air terrace</option><option>Conversation table</option><option>Small talk table</option></select></label><label className="mt-4 block text-sm font-bold">Note<input name="note" placeholder="Private booking" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label><button type="submit" className={`${venueButton.dark} mt-5 w-full`}>Block this slot</button>{blockSaved&&<p role="status" className="mt-3 text-center text-xs font-bold text-signal-ink">✓ Calendar block saved</p>}</form></motion.section>}

        {tab === "overview" && <motion.section key="overview" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-[24px] border border-foreground/15 bg-card p-6"><VenueKicker>Payout summary</VenueKicker><h2 className="mt-2 font-display text-3xl font-black">Clear before it&apos;s busy</h2><dl className="mt-6 divide-y divide-foreground/12 text-sm"><div className="flex justify-between py-3"><dt className="text-muted-foreground">Confirmed booking value</dt><dd className="font-bold">{formatRupees(gross)}</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">SCENE fee · 10%</dt><dd className="font-bold">-{formatRupees(gross*.1)}</dd></div><div className="flex justify-between py-4 text-lg"><dt className="font-bold">Your payout</dt><dd className="font-display text-2xl font-black">{formatRupees(payout)}</dd></div></dl><p className="mt-4 rounded-xl bg-secondary p-4 text-xs leading-5 text-muted-foreground">Bank details and automatic settlement are set up with you before your first paid booking. Figures here follow your confirmed requests, including food and drink orders.</p></div><div className="rounded-[24px] bg-primary p-6 text-white"><VenueKicker className="text-white/65">Demand</VenueKicker><h2 className="mt-2 font-display text-3xl font-black">What organizers are asking for</h2>{bookings.length===0?<p className="mt-6 text-sm leading-6 text-white/80">Nothing to report yet. Once organizers start requesting dates, this panel shows which spaces and time slots they actually ask for — measured from your own bookings, never estimated.</p>:<div className="mt-8 space-y-5">{spaceDemand.map(([label,count])=><div key={label}><div className="flex justify-between text-sm font-bold"><span>{label}</span><span>{count} {count===1?"request":"requests"}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{width:`${Math.round((count/bookings.length)*100)}%`}} /></div></div>)}</div>}<p className="mt-8 text-xs leading-5 text-white/60">Counted from real requests to your venue{bookings.length>0?` · ${bookings.length} so far`:""}.</p></div></motion.section>}
      </AnimatePresence>
    </div>
  );
}

"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createHostPreviewRequest, createManualVenueBlock, readManualVenueBlocks, readVenueBookings, savePreviewRequest, updateVenueBooking, venueBookingChangeEvent, type ManualVenueBlock, type VenueBookingRequest } from "@/lib/client/venueBookingStore";
import { formatRupees } from "@/lib/venues";
import { VenueIcon, VenueKicker, VenueStatus, venueButton } from "@/components/venues/VenueUi";

type HostTab = "requests" | "calendar" | "overview";

function readableDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+05:30`));
}

export function HostDashboard() {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<HostTab>("requests");
  const [requests, setRequests] = useState<VenueBookingRequest[]>([]);
  const [blocks, setBlocks] = useState<ManualVenueBlock[]>([]);
  const [ready, setReady] = useState(false);
  const [usingPreview, setUsingPreview] = useState(false);
  const [blockSaved, setBlockSaved] = useState(false);

  const refresh = useCallback(() => {
    const saved = readVenueBookings();
    setRequests(saved.length ? saved : [createHostPreviewRequest()]);
    setUsingPreview(!saved.length);
    setBlocks(readManualVenueBlocks());
    setReady(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener(venueBookingChangeEvent(), refresh);
    window.addEventListener("storage", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener(venueBookingChangeEvent(), refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);

  const confirmed = requests.filter((request) => request.status === "confirmed");
  const gross = confirmed.reduce((sum, request) => sum + (request.total ?? 0), 0);
  const payout = Math.round(gross * 0.9);
  const pending = requests.filter((request) => request.status === "pending").length;
  /** Which spaces organizers actually request, counted from real bookings. */
  const spaceDemand = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of requests) {
      counts.set(request.spaceName, (counts.get(request.spaceName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [requests]);
  const nextDates = useMemo(() => [...requests.filter((request) => request.status !== "declined"), ...blocks].sort((a,b)=>a.date.localeCompare(b.date)), [requests, blocks]);

  function decide(request: VenueBookingRequest, status: "approved" | "declined") {
    if (usingPreview) savePreviewRequest(request);
    updateVenueBooking(request.id, status);
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
        <div className="rounded-[20px] border border-foreground/15 bg-card p-5"><p className="text-xs text-muted-foreground">Needs your response</p><p className="mt-2 font-display text-4xl font-black">{pending}</p><p className="mt-1 text-xs text-muted-foreground">Reply within 48 hours</p></div>
        <div className="rounded-[20px] border border-foreground/15 bg-card p-5"><p className="text-xs text-muted-foreground">Confirmed bookings</p><p className="mt-2 font-display text-4xl font-black">{confirmed.length}</p><p className="mt-1 text-xs text-muted-foreground">Across all spaces</p></div>
        <div className="rounded-[20px] bg-foreground p-5 text-background"><p className="text-xs text-background/55">Upcoming payout</p><p className="mt-2 font-display text-4xl font-black">{formatRupees(payout)}</p><p className="mt-1 text-xs text-background/55">After SCENE&apos;s 10% fee</p></div>
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-foreground/15" role="tablist" aria-label="Host dashboard sections">
        {([['requests',`Requests ${pending ? `(${pending})` : ""}`],['calendar','Calendar'],['overview','Payouts & insights']] as [HostTab,string][]).map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} onClick={()=>setTab(id)} className={`relative shrink-0 px-4 py-3 text-sm font-bold ${tab===id?"text-foreground":"text-muted-foreground hover:text-foreground"}`}>{label}{tab===id&&<motion.span layoutId="host-tab" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" transition={{type:"spring",stiffness:420,damping:34}} />}</button>)}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === "requests" && <motion.section key="requests" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="mt-6 space-y-5">
          {usingPreview && <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm leading-6"><VenueIcon name="spark" className="mt-0.5 size-5 shrink-0 text-accent" /><span><strong>Preview request.</strong> This example shows the host flow before a real organizer submits. Approving or declining it saves the demo locally.</span></div>}
          {requests.map((request)=><article key={request.id} className="overflow-hidden rounded-[24px] border border-foreground/15 bg-card"><div className="flex flex-col gap-4 border-b border-foreground/12 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><div className="flex flex-wrap gap-2"><VenueKicker>{request.eventType}</VenueKicker><VenueStatus status={request.status} /></div><h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em]">{request.name}</h2><p className="mt-1 text-sm text-muted-foreground">wants {request.spaceName}</p></div><div className="rounded-2xl bg-secondary px-4 py-3"><p className="font-display text-xl font-black">{readableDate(request.date)}</p><p className="mt-1 text-xs text-muted-foreground">{request.time} · {request.duration}h · {request.people} people</p></div></div><div className="grid gap-px bg-foreground/10 lg:grid-cols-[1.4fr_.8fr]"><div className="bg-card p-5 sm:p-6"><p className="text-xs font-bold text-muted-foreground">Event plan</p><p className="mt-2 text-sm leading-6">{request.description}</p><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Organizer contact</dt><dd className="mt-1 font-semibold">{request.email}<br />{request.phone}</dd></div><div><dt className="text-xs text-muted-foreground">Trust link</dt><dd className="mt-1"><a href={request.trustUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">Open {request.trustType}</a></dd></div></dl></div><div className="bg-[#f3f1e9] p-5 sm:p-6"><p className="text-xs text-muted-foreground">Organizer pays</p><p className="mt-1 font-display text-2xl font-black">{request.total===null?"Your quote":formatRupees(request.total)}</p>{request.total!==null&&<><div className="mt-4 flex justify-between border-t border-foreground/12 pt-3 text-sm"><span className="text-muted-foreground">SCENE fee · 10%</span><span>-{formatRupees(request.total*.1)}</span></div><div className="mt-2 flex justify-between text-sm font-bold"><span>You receive</span><span>{formatRupees(request.total*.9)}</span></div></>}</div></div><div className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6"><p className="max-w-lg text-xs leading-5 text-muted-foreground">Approving holds this slot for 24 hours while the organizer pays. Declining sends a clear unavailable status and never charges them.</p>{request.status==="pending"?<div className="flex gap-2"><button type="button" onClick={()=>decide(request,"declined")} className={venueButton.outline}>Decline</button><button type="button" onClick={()=>decide(request,"approved")} className={venueButton.primary}>Approve request <VenueIcon name="check" className="size-4" /></button></div>:<Link href="/bookings" className={venueButton.outline}>See organizer view</Link>}</div></article>)}
        </motion.section>}

        {tab === "calendar" && <motion.section key="calendar" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]"><div className="overflow-hidden rounded-[24px] border border-foreground/15 bg-card"><div className="border-b border-foreground/12 p-5 sm:p-6"><VenueKicker>Availability</VenueKicker><h2 className="mt-1 font-display text-2xl font-black">Upcoming dates</h2></div><div className="divide-y divide-foreground/12">{nextDates.length?nextDates.map((item)=><div key={item.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-center font-mono text-[10px] font-bold uppercase">{readableDate(item.date).split(',')[0]}</div><div><p className="font-bold">{'eventType' in item ? `${item.eventType} · ${item.spaceName}` : `Blocked · ${item.spaceName}`}</p><p className="mt-1 text-xs text-muted-foreground">{'time' in item ? `${item.time} · ${item.duration}h` : `${item.from}–${item.to}`} · {'name' in item ? item.name : item.note}</p></div></div>{'status' in item&&<VenueStatus status={item.status} />}</div>):<div className="p-8 text-center text-sm text-muted-foreground">No requests or manual blocks yet.</div>}</div></div><form onSubmit={addBlock} className="h-fit rounded-[24px] border border-foreground/15 bg-card p-5 sm:p-6"><VenueKicker>Manual booking</VenueKicker><h2 className="mt-1 font-display text-2xl font-black">Block a slot</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use this for friends, private bookings, maintenance, or anything arranged outside SCENE.</p><label className="mt-5 block text-sm font-bold">Date<input required name="date" type="date" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-bold">From<input required name="from" type="time" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label><label className="text-sm font-bold">To<input required name="to" type="time" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label></div><label className="mt-4 block text-sm font-bold">Space<select name="space" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary"><option>First-floor event space</option><option>Open-air terrace</option><option>Conversation table</option><option>Small talk table</option></select></label><label className="mt-4 block text-sm font-bold">Note<input name="note" placeholder="Private booking" className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 outline-none focus:border-primary" /></label><button type="submit" className={`${venueButton.dark} mt-5 w-full`}>Block this slot</button>{blockSaved&&<p role="status" className="mt-3 text-center text-xs font-bold text-signal-ink">✓ Calendar block saved</p>}</form></motion.section>}

        {tab === "overview" && <motion.section key="overview" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-[24px] border border-foreground/15 bg-card p-6"><VenueKicker>Payout summary</VenueKicker><h2 className="mt-2 font-display text-3xl font-black">Clear before it&apos;s busy</h2><dl className="mt-6 divide-y divide-foreground/12 text-sm"><div className="flex justify-between py-3"><dt className="text-muted-foreground">Confirmed booking value</dt><dd className="font-bold">{formatRupees(gross)}</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">SCENE fee · 10%</dt><dd className="font-bold">-{formatRupees(gross*.1)}</dd></div><div className="flex justify-between py-4 text-lg"><dt className="font-bold">Your payout</dt><dd className="font-display text-2xl font-black">{formatRupees(payout)}</dd></div></dl><p className="mt-4 rounded-xl bg-secondary p-4 text-xs leading-5 text-muted-foreground">Bank details and automatic settlement are set up with you before your first paid booking. Figures here follow your confirmed requests.</p></div>{/* This panel used to show invented demand bars (68/54/47%) captioned
                "What organizers are asking for". Labelled illustrative, but they
                looked exactly like real analytics — so it reported numbers no
                booking had produced. It now counts what actually happened. */}
            <div className="rounded-[24px] bg-primary p-6 text-white"><VenueKicker className="text-white/65">Demand</VenueKicker><h2 className="mt-2 font-display text-3xl font-black">What organizers are asking for</h2>{requests.length===0?<p className="mt-6 text-sm leading-6 text-white/80">Nothing to report yet. Once organizers start requesting dates, this panel shows which spaces and time slots they actually ask for — measured from your own bookings, never estimated.</p>:<div className="mt-8 space-y-5">{spaceDemand.map(([label,count])=><div key={label}><div className="flex justify-between text-sm font-bold"><span>{label}</span><span>{count} {count===1?"request":"requests"}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{width:`${Math.round((count/requests.length)*100)}%`}} /></div></div>)}</div>}<p className="mt-8 text-xs leading-5 text-white/60">Counted from real requests to your venue{requests.length>0?` · ${requests.length} so far`:""}.</p></div></motion.section>}
      </AnimatePresence>
    </div>
  );
}

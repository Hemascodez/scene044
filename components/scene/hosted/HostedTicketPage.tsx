"use client";

import "@fontsource-variable/montserrat";
import "@fontsource-variable/work-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { clearStoredTicketToken, httpRegistrationApi, mockRegistrationApi, readStoredTicketToken, type Ticket } from "@/lib/client/eventRegistration";
import { validEventTicketToken } from "@/lib/eventTicketLocation";
import { eventPath } from "@/lib/seo";
import { formatSceneDateLong } from "@/lib/client/istTime";
import { playTicketPrint, primeTicketSound, PRINT_TIMING } from "@/lib/client/ticketSound";
import type { HostedEventDetail } from "@/lib/hostedEvents";
import { TicketView } from "./TicketView";
import { TicketPrinter } from "./TicketPrinter";

/** A separate, private page. A URL token is not a ticket until the server validates it. */
export function HostedTicketPage({ event, preview = false }: { event: HostedEventDetail; preview?: boolean }) {
  const api = useMemo(() => preview ? mockRegistrationApi() : httpRegistrationApi(event.id), [event.id, preview]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const visit = useRef<{ token: string | null; fresh: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ticket");
    // Capture once before scrubbing history. Strict Mode runs this effect twice;
    // the second run must not lose a newly-paid visit's animation flag.
    visit.current ??= { token: fromUrl || readStoredTicketToken(event.id), fresh: params.get("new") === "1" };
    const { token, fresh } = visit.current;
    // Remove the credential from history and referrers, including invalid tokens.
    if (fromUrl || params.has("new")) window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!token || (!preview && !validEventTicketToken(token))) {
      const timer = setTimeout(() => { setLoading(false); setError("Open your ticket from My bookings or the private ticket link."); }, 0);
      return () => { active = false; clearTimeout(timer); };
    }
    // The visit ref retains the token for network retries, but opening a shared
    // bearer link must never save someone else's pass as this viewer's booking.
    void api.getTicket(token).then(result => {
      if (!active) return;
      if (!result) {
        if (readStoredTicketToken(event.id) === token) clearStoredTicketToken(event.id);
        setError("That ticket could not be found. Open My bookings to find your pass.");
        return;
      }
      setTicket(result);
      setError("");
      if (fresh && result.status === "confirmed") setCelebrate(true);
    }).catch(() => { if (active) setError("Couldn't load your ticket. Check your connection and retry. You do not need to pay again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, attempt, event.id, preview]);
  return <MotionConfig reducedMotion="user"><main className="hosted-surface hosted-dark min-h-[80dvh] px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-xl">
      {preview && <p className="mb-4 border border-white/20 p-3 font-mono text-xs">LOCAL PREVIEW · Not a real payment or ticket</p>}
      <h1 className="font-display text-3xl font-black">Your event ticket</h1>
      <p className="mt-2 text-sm text-muted-foreground">{event.title}</p>
      <section className={`mt-6 ${!ticket || error || ticket.status === 'cancelled' ? 'border border-white/20 bg-card p-4 sm:p-6' : ''}`} aria-live="polite">
        {loading ? <p role="status">Loading your confirmed ticket…</p> : error ? <>
          <p role="alert" className="text-sm">{error}</p>
          <button className="mt-4 min-h-12 border border-white/40 px-4" onClick={() => { setLoading(true); setAttempt(n => n + 1); }}>Retry loading ticket</button>
        </> : ticket?.status === "cancelled" ? <><h2 className="text-xl font-bold">Ticket cancelled</h2><p className="mt-2 text-sm">{ticket.code} is not valid for entry. Contact SCENE if you need help.</p></> : ticket ? <>
          {celebrate ? <FreshTicket ticket={ticket} event={event} /> : <TicketView ticket={ticket} event={event} />}
        </> : null}
      </section>
      <nav className="mt-5 flex flex-wrap gap-4 text-sm" aria-label="Ticket navigation">
        <Link href="/bookings" className="inline-flex min-h-11 items-center underline underline-offset-4">My bookings</Link>
        <Link href={preview ? "/dev/hosted-event" : eventPath(event)} className="inline-flex min-h-11 items-center underline underline-offset-4">Back to event</Link>
      </nav>
    </div>
  </main></MotionConfig>;
}

/** Preserve Claude's printer, then transition to the supplied scannable QR screen. */
function FreshTicket({ ticket, event }: { ticket: Ticket; event: HostedEventDetail }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"printing" | "printed">("printing");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const feed = window.setTimeout(() => {
      setPhase("printed");
      if (!reduced) { primeTicketSound(); playTicketPrint(); }
    }, reduced ? 0 : 250);
    const ready = window.setTimeout(() => setRevealed(true), reduced ? 0 : 250 + PRINT_TIMING.feedMs + PRINT_TIMING.settleMs + 350);
    return () => { window.clearTimeout(feed); window.clearTimeout(ready); };
  }, [reduced]);
  return <div style={{ "--tp-label": "#f4f2ea" } as CSSProperties}>
    <p role="status" className="mb-4 font-mono text-xs text-[#86efac]">{revealed ? "Payment successful · ticket ready" : "Payment successful · printing your ticket…"}</p>
    <AnimatePresence mode="wait" initial={false}>
      {revealed ? <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}><TicketView ticket={ticket} event={event} /></motion.div>
        : <motion.div key="printer" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><TicketPrinter phase={phase} eventTitle={event.title} guestName={ticket.name} eventDate={event.startAt ? formatSceneDateLong(event.startAt) : ""} /></motion.div>}
    </AnimatePresence>
  </div>;
}

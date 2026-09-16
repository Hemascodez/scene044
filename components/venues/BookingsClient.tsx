"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { readVenueBookings, updateVenueBooking, venueBookingChangeEvent, type VenueBookingRequest } from "@/lib/client/venueBookingStore";
import { openRazorpayCheckout } from "@/lib/client/razorpay";
import { formatRupees } from "@/lib/venues";
import { VenueIcon, VenueKicker, VenueStatus, venueButton } from "@/components/venues/VenueUi";
import { LottiePlayer } from "@/components/ui/LottiePlayer";

function prettyDate(date: string) {
  if (!date) return "Date not selected";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00+05:30`));
}

export function BookingsClient() {
  const reduceMotion = useReducedMotion();
  const [bookings, setBookings] = useState<VenueBookingRequest[]>([]);
  const [ready, setReady] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const refresh = useCallback(() => { setBookings(readVenueBookings()); setReady(true); }, []);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener(venueBookingChangeEvent(), refresh);
    window.addEventListener("storage", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener(venueBookingChangeEvent(), refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);

  async function confirmPayment(booking: VenueBookingRequest) {
    setPayError(null);
    setPaying(true);
    try {
      const orderResponse = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueSlug: booking.venueSlug,
          spaceId: booking.spaceId,
          eventType: booking.eventType,
          duration: booking.duration,
          receipt: booking.id,
        }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok || !order.ok) throw new Error(order.error ?? "Could not start payment.");

      await openRazorpayCheckout({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: booking.venueName,
        description: `${booking.spaceName} · ${booking.duration}h`,
        prefill: { name: booking.name, email: booking.email, contact: booking.phone },
        onSuccess: async (response) => {
          try {
            const verifyResponse = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok || !verified.ok) throw new Error("Payment could not be verified.");
            updateVenueBooking(booking.id, "confirmed");
            setPayingId(null);
            refresh();
          } catch (err) {
            setPayError(err instanceof Error ? err.message : "Payment could not be verified.");
          } finally {
            setPaying(false);
          }
        },
        onDismiss: () => setPaying(false),
        onFailed: (message) => {
          setPayError(message);
          setPaying(false);
        },
      });
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not start payment.");
      setPaying(false);
    }
  }

  if (!ready) return (
    <div className="grid min-h-60 place-items-center rounded-[24px] bg-card">
      <LottiePlayer src="/lottie/loading.json" className="size-16" fallback={<div className="size-16 animate-pulse rounded-full bg-muted" />} />
    </div>
  );

  if (!bookings.length) return (
    <div className="rounded-[26px] border border-dashed border-foreground/25 bg-card px-6 py-14 text-center">
      <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-full bg-secondary">
        <LottiePlayer src="/lottie/empty-bookings.json" className="size-16" fallback={<VenueIcon name="calendar" className="size-6" />} />
      </div>
      <h2 className="mt-5 font-display text-3xl font-black tracking-[-0.05em]">No venue requests yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Find a space, share your plan with the host, and track every approval and payment here.</p>
      <Link href="/venues" className={`${venueButton.primary} mt-6`}>Find a venue <VenueIcon name="arrow" className="size-4" /></Link>
    </div>
  );

  return <div className="space-y-5">{bookings.map((booking) => (
    <motion.article key={booking.id} layout className="overflow-hidden rounded-[24px] border border-foreground/15 bg-card" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col gap-4 border-b border-foreground/12 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><VenueKicker>{booking.eventType}</VenueKicker><VenueStatus status={booking.status} /></div><h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em]">{booking.venueName} · {booking.spaceName}</h2><p className="mt-2 text-sm text-muted-foreground">{prettyDate(booking.date)} · {booking.time} · {booking.duration}h · {booking.people} people</p></div><div className="shrink-0 text-left sm:text-right"><p className="text-xs text-muted-foreground">Venue total</p><p className="mt-1 font-display text-2xl font-black">{booking.total === null ? "Host quote" : formatRupees(booking.total)}</p></div></div>
      <div className="grid gap-px bg-foreground/10 sm:grid-cols-3"><div className="bg-card p-5"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">01 · Request</p><p className="mt-2 text-sm font-bold">Sent to {booking.venueName}</p></div><div className={`p-5 ${booking.status === "pending" || booking.status === "declined" ? "bg-[#f3f1e9] text-muted-foreground" : "bg-card"}`}><p className="font-mono text-[9px] uppercase tracking-[0.15em]">02 · Approval</p><p className="mt-2 text-sm font-bold">{booking.status === "pending" ? "Waiting for host" : booking.status === "declined" ? "Slot unavailable" : "Host approved"}</p></div><div className={`p-5 ${booking.status === "confirmed" ? "bg-card" : "bg-[#f3f1e9] text-muted-foreground"}`}><p className="font-mono text-[9px] uppercase tracking-[0.15em]">03 · Confirm</p><p className="mt-2 text-sm font-bold">{booking.status === "confirmed" ? "Payment complete" : booking.status === "approved" ? "Ready for payment" : "Unlocks after approval"}</p></div></div>
      <div className="p-5 sm:p-6">
        {booking.status === "pending" && <div className="flex items-start gap-3 rounded-2xl bg-warn/10 p-4 text-sm leading-6 text-warn-ink"><VenueIcon name="clock" className="mt-0.5 size-5 shrink-0" /><span><strong>The host is reviewing your plan.</strong> They have up to 48 hours to approve, decline, or contact you on WhatsApp.</span></div>}
        {booking.status === "approved" && <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-signal/10 p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3 text-sm leading-6 text-signal-ink"><VenueIcon name="check" className="mt-0.5 size-5 shrink-0" /><span><strong>Your request is approved.</strong><br />This slot is held for 24 hours while you pay.</span></div><button type="button" onClick={()=>setPayingId(booking.id)} className={venueButton.primary}><VenueIcon name="wallet" className="size-4" /> Pay &amp; confirm</button></div>}
        {booking.status === "confirmed" && <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-signal-ink text-white"><VenueIcon name="check" /></div><div><p className="font-display text-xl font-black">You&apos;re booked.</p><p className="mt-1 text-sm text-muted-foreground">Show booking code <strong className="font-mono text-foreground">SCN-{booking.id.slice(0,4).toUpperCase()}</strong> at reception.</p></div></div><a href="https://www.google.com/maps/search/?api=1&query=Time+Cafe+Nungambakkam+Chennai" target="_blank" rel="noreferrer" className={venueButton.outline}>Directions <VenueIcon name="arrow" className="size-4" /></a></div>}
        {booking.status === "declined" && <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><p className="text-sm leading-6 text-muted-foreground">{booking.venueName} could not host this slot. You have not been charged.</p><Link href="/venues/search" className={venueButton.outline}>Change date</Link></div>}
      </div>

      <AnimatePresence>{payingId === booking.id && <motion.div className="border-t border-foreground/12 bg-foreground p-5 text-background sm:p-6" initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><VenueKicker className="text-primary">Confirm your booking</VenueKicker><p className="mt-1 font-display text-2xl font-black">{booking.total === null ? "Await final host quote" : formatRupees(booking.total)}</p><p className="mt-1 text-xs text-background/55">Pay securely with Razorpay — card, UPI, or netbanking. Your slot confirms the moment payment is verified.</p>{payError && <p className="mt-2 text-xs font-semibold text-primary">{payError}</p>}</div><div className="flex gap-2"><button type="button" onClick={()=>{setPayingId(null); setPayError(null);}} disabled={paying} className="min-h-11 rounded-full border border-background/25 px-4 text-sm font-bold disabled:opacity-45">Cancel</button><button type="button" disabled={booking.total === null || paying} onClick={()=>confirmPayment(booking)} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-45">{paying ? "Opening payment…" : "Pay now"}</button></div></div></motion.div>}</AnimatePresence>
    </motion.article>
  ))}</div>;
}

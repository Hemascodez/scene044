"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MyBookings from "./MyBookings";
import { useVenueApp } from "./VenueApp";
import type { Booking, Review } from "./bookingsData";
import { fetchMyBookings, type VenueBooking } from "@/lib/client/venueBookingStore";
import { openRazorpayCheckout } from "@/lib/client/razorpay";
import { submitSelfReportedReview } from "@/lib/client/venueReviewApi";
import { amountDue, formatRupees } from "@/lib/venues";

/**
 * Feeds the prototype's My Bookings screen with real data: the organiser's
 * bookings from the account API, real Razorpay
 * payment, real withdraw, and reviews sent to the real curator queue.
 */

/** The design's photo for each real space. */
const SPACE_PHOTO: Record<string, string> = {
  "first-floor": "/venues/figma/spaces-f33c5.jpg",
  "korean-table": "/venues/figma/spaces-86081.jpg",
  "standard-table": "/venues/figma/spaces-d5006.jpg",
  terrace: "/venues/figma/spaces-terrace_1.jpg",
};
const REVIEWS_KEY_PREFIX = "scene044.myReviews.v2:";

function prettyDate(date: string) {
  const d = new Date(`${date}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return date;
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Kolkata" });
  const rest = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${wd}, ${rest}`;
}

/** Real status → the design's status vocabulary. */
function toDesign(entry: { booking: VenueBooking; qrSvg: string }): Booking {
  const b = entry.booking;
  const status: Booking["status"] =
    b.status === "requested" ? "sent"
    : b.status === "approved" ? "due"
    : b.status === "confirmed" || b.status === "checked_in" ? "confirmed"
    : b.status === "completed" ? "completed"
    : b.status === "declined" || b.status === "expired" ? "declined"
    : "withdrawn";
  const note =
    b.status === "declined" ? `${b.venueName} couldn't host this slot. You have not been charged.`
    : b.status === "expired" ? "This request expired — the host didn't reply in time. Nothing was charged."
    : undefined;
  return {
    id: String(b.id),
    status,
    eventType: b.eventType,
    venue: b.venueName,
    space: b.spaceName,
    img: SPACE_PHOTO[b.spaceId] ?? "/venues/figma/spaces-f33c5.jpg",
    date: prettyDate(b.eventDate),
    time: `${b.startTime} · ${b.trialDurationMinutes ? '5-minute live trial' : `${b.durationHours} ${b.durationHours === 1 ? "hour" : "hours"}`}`,
    guests: `${b.people} people`,
    sentAt: Date.parse(b.createdAt),
    // Listed venue price only (matches Razorpay); commission is host-side.
    amount: b.trialAmountPaise !== null ? formatRupees(b.trialAmountPaise / 100) : b.total === null ? "Host quote" : formatRupees(amountDue(b.total)),
    code: b.code,
    note,
    token: b.checkinToken,
    qrSvg: entry.qrSvg,
    endsAt: b.status === 'checked_in' ? b.endsAt : null,
  };
}

function loadReviews(phone: string | undefined): Review[] {
  if (!phone) return [];
  try {
    return JSON.parse(localStorage.getItem(`${REVIEWS_KEY_PREFIX}${phone}`) ?? "[]");
  } catch {
    return [];
  }
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { profile, authReady, saveProfile, openAuth, logout, notify } = useVenueApp();
  const [raw, setRaw] = useState<Array<{ booking: VenueBooking; qrSvg: string }>>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviewState, setReviewState] = useState<{ phone: string | null; items: Review[] }>({ phone: null, items: [] });
  const reviews = reviewState.phone === (profile?.phone ?? null) ? reviewState.items : [];

  const refresh = useCallback((signal?: AbortSignal) => {
    fetchMyBookings(signal).then((entries) => {
      if (signal?.aborted) return;
      setRaw(entries);
      setBookings(entries.map(toDesign));
    }).catch((error) => {
      if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") return;
      notify(error instanceof Error ? error.message : "Could not load your bookings.");
    });
  }, [notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage after mount; it does not exist during server rendering
    setReviewState({ phone: profile?.phone ?? null, items: loadReviews(profile?.phone) });
    if (!authReady || !profile) {
      setRaw([]);
      setBookings([]);
      return;
    }
    const controller = new AbortController();
    refresh(controller.signal);
    const id = window.setInterval(() => refresh(controller.signal), 15000);
    return () => { controller.abort(); window.clearInterval(id); };
  }, [refresh, authReady, profile]);

  const setReviews = (fn: (r: Review[]) => Review[]) =>
    setReviewState((current) => {
      const phone = profile?.phone ?? null;
      const next = fn(current.phone === phone ? current.items : []);
      if (phone) localStorage.setItem(`${REVIEWS_KEY_PREFIX}${phone}`, JSON.stringify(next));
      return { phone, items: next };
    });

  async function pay(b: Booking) {
    const entry = raw.find((e) => e.booking.checkinToken === b.token);
    if (!entry) throw new Error("Could not find this booking. Refresh and try again.");
    const order = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: entry.booking.checkinToken }),
    }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));
    if (!order.ok || !order.data.ok) throw new Error(order.data.error ?? "Could not start payment.");
    if (order.data.alreadyPaid) { refresh(); return; }

    await new Promise<void>((resolve, reject) => {
      openRazorpayCheckout({
        keyId: order.data.keyId,
        orderId: order.data.orderId,
        amount: order.data.amount,
        currency: order.data.currency,
        name: entry.booking.venueName,
        description: `${entry.booking.spaceName} · ${entry.booking.trialDurationMinutes ? '5-minute live trial' : `${entry.booking.durationHours}h`}`,
        prefill: { name: entry.booking.organizerName, email: entry.booking.organizerEmail, contact: entry.booking.organizerPhone },
        onSuccess: async (response) => {
          try {
          const verified = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, token: entry.booking.checkinToken }),
          }).then(async (r) => r.ok && (await r.json().catch(() => ({}))).ok);
          if (!verified) return reject(new Error("Payment could not be verified."));
          refresh();
          resolve();
          } catch { reject(new Error('Payment verification interrupted. Retry Pay & confirm to recover your payment without another charge.')); }
        },
        onDismiss: () => reject(new Error("Payment cancelled.")),
        onFailed: (message) => reject(new Error(message)),
      }).catch(reject);
    });
  }

  async function withdraw(b: Booking) {
    const res = await fetch(`/api/venue-bookings/${b.token}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not withdraw this request.");
    refresh();
  }

  async function publishReview(r: { venue: string; eventType: string; rating: number; tags: string[]; text: string }) {
    await submitSelfReportedReview("time-cafe", {
      reviewerName: profile?.name ?? "Organiser",
      eventType: r.eventType,
      rating: Math.min(5, Math.max(3, Math.round(r.rating))) as 3 | 4 | 5,
      tags: r.tags,
      comment: r.text,
    });
  }

  if (!authReady) return <div className="min-h-dvh bg-paper px-5 py-20 text-center text-stone" role="status">Loading your account…</div>;

  return (
    <MyBookings
      key={profile?.phone ?? "anonymous"}
      profile={profile}
      bookings={bookings}
      setBookings={(fn) => setBookings(fn)}
      reviews={reviews}
      setReviews={setReviews}
      onSaveProfile={saveProfile}
      onAuth={openAuth}
      onExplore={() => router.push("/venues")}
      onHome={() => router.push("/venues")}
      onLogout={logout}
      onPay={pay}
      onWithdrawBooking={withdraw}
      onPublishReview={publishReview}
      hostReviews={[]}
    />
  );
}

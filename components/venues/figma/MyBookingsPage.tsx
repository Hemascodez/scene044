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
 * bookings from the API (by the tokens this browser holds), real Razorpay
 * payment, real withdraw, and reviews sent to the real curator queue.
 */

/** The design's photo for each real space. */
const SPACE_PHOTO: Record<string, string> = {
  "first-floor": "/venues/figma/spaces-f33c5.jpg",
  "korean-table": "/venues/figma/spaces-86081.jpg",
  "standard-table": "/venues/figma/spaces-d5006.jpg",
  terrace: "/venues/figma/spaces-terrace_1.jpg",
};
const REVIEWS_KEY = "scene044.myReviews.v1";

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
    time: `${b.startTime} · ${b.durationHours} ${b.durationHours === 1 ? "hour" : "hours"}`,
    guests: `${b.people} people`,
    sentAt: Date.parse(b.createdAt),
    // What the organiser pays: space cost + SCENE's 10% fee (matches Razorpay).
    amount: b.total === null ? "Host quote" : formatRupees(amountDue(b.total)),
    code: b.code,
    note,
    token: b.checkinToken,
    qrSvg: entry.qrSvg,
  };
}

function loadReviews(): Review[] {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { profile, saveProfile, openAuth, logout } = useVenueApp();
  const [raw, setRaw] = useState<Array<{ booking: VenueBooking; qrSvg: string }>>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviewsState] = useState<Review[]>([]);

  const refresh = useCallback(() => {
    fetchMyBookings().then((entries) => {
      setRaw(entries);
      setBookings(entries.map(toDesign));
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage after mount; it does not exist during server rendering
    setReviewsState(loadReviews());
    refresh();
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const setReviews = (fn: (r: Review[]) => Review[]) =>
    setReviewsState((current) => {
      const next = fn(current);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(next));
      return next;
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

    await new Promise<void>((resolve, reject) => {
      openRazorpayCheckout({
        orderId: order.data.orderId,
        amount: order.data.amount,
        currency: order.data.currency,
        name: entry.booking.venueName,
        description: `${entry.booking.spaceName} · ${entry.booking.durationHours}h`,
        prefill: { name: entry.booking.organizerName, email: entry.booking.organizerEmail, contact: entry.booking.organizerPhone },
        onSuccess: async (response) => {
          const verified = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, token: entry.booking.checkinToken }),
          }).then(async (r) => r.ok && (await r.json().catch(() => ({}))).ok);
          if (!verified) return reject(new Error("Payment could not be verified."));
          refresh();
          resolve();
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

  return (
    <MyBookings
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

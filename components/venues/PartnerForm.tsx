"use client";

import { useState, type FormEvent } from "react";
import { VenueIcon, venueButton } from "@/components/venues/VenueUi";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function PartnerForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      phone: form.get("phone"),
      venue: form.get("venue"),
      area: form.get("area"),
      link: form.get("link"),
      details: form.get("details"),
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/venues/partner-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not submit right now. Try again shortly.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return <div className="rounded-[24px] border border-foreground/15 bg-card p-8 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-signal-ink text-white"><VenueIcon name="check" className="size-7" /></div><h2 className="mt-5 font-display text-3xl font-black tracking-[-0.05em]">You&apos;re on the partner list.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">We&apos;ll contact you to verify the space, photograph it properly, and agree on capacity, pricing, and booking rules before anything goes live.</p></div>;
  return <form onSubmit={submit} className="rounded-[24px] border border-foreground/15 bg-card p-5 shadow-[0_20px_60px_rgba(20,19,13,0.08)] sm:p-7"><h2 className="font-display text-2xl font-black tracking-[-0.04em]">Register your interest</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This is a guided pilot, not instant self-publishing.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold">Your name *</span><input required name="name" autoComplete="name" className={inputClass} /></label><label><span className="text-sm font-bold">WhatsApp number *</span><input required name="phone" type="tel" autoComplete="tel" className={inputClass} /></label></div><label className="mt-4 block"><span className="text-sm font-bold">Venue name *</span><input required name="venue" className={inputClass} /></label><label className="mt-4 block"><span className="text-sm font-bold">Area in Chennai *</span><input required name="area" placeholder="For example, Nungambakkam" className={inputClass} /></label><label className="mt-4 block"><span className="text-sm font-bold">Instagram or website</span><input name="link" type="url" placeholder="https://" className={inputClass} /></label><label className="mt-4 block"><span className="text-sm font-bold">Tell us about the space *</span><textarea required name="details" rows={4} placeholder="Capacity, types of events, available spaces, and useful equipment" className={`${inputClass} py-3`} /></label>{error && <p className="mt-4 text-sm font-semibold text-primary-ink">{error}</p>}<button type="submit" disabled={submitting} className={`${venueButton.primary} mt-6 w-full disabled:opacity-60`}>{submitting ? "Sending…" : "Send venue details"} <VenueIcon name="arrow" className="size-4" /></button><p className="mt-3 text-center text-xs text-muted-foreground">No fee to register interest. We review every venue manually.</p></form>;
}

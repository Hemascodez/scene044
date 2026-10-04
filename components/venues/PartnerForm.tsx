"use client";

import { useState, type FormEvent } from "react";
import { VenueIcon, venueButton } from "@/components/venues/VenueUi";

const inputClass = "mt-2 min-h-12 w-full border-[1.5px] border-foreground bg-white px-3.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus:shadow-hard-sm focus-visible:ring-2 focus-visible:ring-primary";
const labelClass = "font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";

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

  if (sent) return <div className="border-[1.5px] border-foreground bg-venue-card p-8 text-center shadow-hard"><div className="mx-auto grid size-14 place-items-center border-[1.5px] border-foreground bg-signal text-white"><VenueIcon name="check" className="size-7" /></div><h2 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.03em]">You&apos;re on the partner list.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">We&apos;ll contact you to verify the space, photograph it properly, and agree on capacity, pricing, and booking rules before anything goes live.</p></div>;
  return <form onSubmit={submit} className="border-[1.5px] border-foreground bg-venue-card p-5 shadow-hard-lg sm:p-7"><h2 className="font-display text-2xl font-extrabold tracking-[-0.03em]">Register your interest</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This is a guided pilot, not instant self-publishing.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Your name *</span><input required name="name" autoComplete="name" className={inputClass} /></label><label><span className={labelClass}>WhatsApp number *</span><input required name="phone" type="tel" autoComplete="tel" className={inputClass} /></label></div><label className="mt-4 block"><span className={labelClass}>Venue name *</span><input required name="venue" className={inputClass} /></label><label className="mt-4 block"><span className={labelClass}>Area in Chennai *</span><input required name="area" placeholder="For example, Nungambakkam" className={inputClass} /></label><label className="mt-4 block"><span className={labelClass}>Instagram or website</span><input name="link" type="url" placeholder="https://" className={inputClass} /></label><label className="mt-4 block"><span className={labelClass}>Tell us about the space *</span><textarea required name="details" rows={4} placeholder="Capacity, types of events, available spaces, and useful equipment" className={`${inputClass} py-3`} /></label>{error && <p role="alert" className="mt-4 border-[1.5px] border-primary-ink bg-primary/10 px-4 py-3 text-sm font-semibold text-primary-ink">{error}</p>}<button type="submit" disabled={submitting} className={`${venueButton.primary} mt-6 w-full disabled:opacity-60`}>{submitting ? "Sending…" : "Send venue details"} <VenueIcon name="arrow" className="size-4" /></button><p className="mt-3 text-center text-xs text-muted-foreground">No fee to register interest. We review every venue manually.</p></form>;
}

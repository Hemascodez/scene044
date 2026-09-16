"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createVenueBooking } from "@/lib/client/venueBookingStore";
import { useScrollLock } from "@/lib/client/useScrollLock";
import { TIME_CAFE, VENUE_EVENT_TYPES, formatRupees, rateForSpace, type VenueEventType, type VenueSpace } from "@/lib/venues";
import { VenueIcon, VenueKicker, venueButton } from "@/components/venues/VenueUi";
import { LottiePlayer } from "@/components/ui/LottiePlayer";

interface BookingFlowProps {
  open: boolean;
  onClose: () => void;
  space: VenueSpace;
  initial: { date: string; time: string; people: number; eventType: string; duration: number };
}

interface FormState {
  date: string;
  time: string;
  duration: number;
  people: number;
  eventType: VenueEventType;
  description: string;
  name: string;
  email: string;
  phone: string;
  trustType: "Instagram" | "LinkedIn" | "Website";
  trustUrl: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  agreedToPolicies: boolean;
}

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";

function fieldLabel(label: string, required = true) {
  return <span className="text-sm font-bold">{label}{required && <span className="text-primary" aria-hidden> *</span>}</span>;
}

export function BookingFlow({ open, onClose, space, initial }: BookingFlowProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    date: initial.date,
    time: initial.time || "18:00",
    duration: initial.duration,
    people: initial.people,
    eventType: (VENUE_EVENT_TYPES.includes(initial.eventType as VenueEventType) ? initial.eventType : "Tech meetup") as VenueEventType,
    description: "",
    name: "",
    email: "",
    phone: "",
    trustType: "LinkedIn",
    trustUrl: "",
    whatsappOptIn: true,
    emailOptIn: true,
    agreedToPolicies: false,
  });

  const hourlyRate = rateForSpace(space, form.eventType);
  const total = hourlyRate === null ? null : hourlyRate * form.duration;

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("button, input, select, textarea, a[href]");
    window.setTimeout(() => first?.focus(), 30);
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"));
      if (!focusable.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);


  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function validateStep() {
    if (step === 1) {
      if (!form.date || !form.time) return "Choose an event date and start time.";
      if (form.people < 1 || form.people > space.maxGuests) return `${space.name} supports up to ${space.maxGuests} people.`;
      if (form.description.trim().length < 20) return "Add a short event description of at least 20 characters.";
    }
    if (step === 2) {
      if (!form.name.trim() || !form.email.includes("@") || form.phone.trim().length < 8) return "Enter your name, email, and mobile number.";
      if (!form.trustUrl.trim()) return "Add one profile or website link.";
    }
    return "";
  }

  function next() {
    const message = validateStep();
    if (message) { setError(message); return; }
    setStep((current) => Math.min(3, current + 1));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.agreedToPolicies) { setError("Accept the venue rules before sending the request."); return; }
    const request = createVenueBooking({
      venueSlug: "time-cafe",
      venueName: TIME_CAFE.name,
      spaceId: space.id,
      spaceName: space.name,
      date: form.date,
      time: form.time,
      duration: form.duration,
      people: form.people,
      eventType: form.eventType,
      description: form.description.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      trustType: form.trustType,
      trustUrl: form.trustUrl.trim(),
      whatsappOptIn: form.whatsappOptIn,
      emailOptIn: form.emailOptIn,
      agreedToPolicies: form.agreedToPolicies,
      hourlyRate,
      total,
    });
    setRequestId(request.id);
  }

  function preventWheelChange(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") event.currentTarget.blur();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center overscroll-contain bg-foreground/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
          <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="booking-title" className="max-h-[94dvh] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-t-[26px] bg-[#f7f5ee] shadow-2xl sm:max-w-2xl sm:rounded-[26px]" initial={reduceMotion ? false : { opacity: 0, y: 36, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.99 }} transition={{ type: "spring", stiffness: 360, damping: 34 }}>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-foreground/12 bg-[#f7f5ee]/95 px-5 py-4 backdrop-blur sm:px-7">
              <div><VenueKicker>Check availability</VenueKicker><h2 id="booking-title" className="mt-1 font-display text-2xl font-black tracking-[-0.04em]">{requestId ? "Request sent" : `Request ${space.name}`}</h2></div>
              <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full border border-foreground/15 bg-card hover:border-foreground" aria-label="Close booking form"><VenueIcon name="close" /></button>
            </div>

            {requestId ? (
              <div className="px-5 py-10 text-center sm:px-10 sm:py-14">
                <div className="relative mx-auto grid size-24 place-items-center">
                  <LottiePlayer
                    src="/lottie/booking-success.json"
                    loop={false}
                    className="size-24"
                    fallback={
                      <div className="grid size-16 place-items-center rounded-full bg-signal-ink text-white">
                        <VenueIcon name="check" className="size-8" />
                      </div>
                    }
                  />
                </div>
                <motion.h3
                  className="mt-5 font-display text-3xl font-black tracking-[-0.05em]"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.2, duration: 0.4 }}
                >
                  {TIME_CAFE.name} has your request.
                </motion.h3>
                <motion.p
                  className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.28, duration: 0.4 }}
                >
                  You&apos;ll hear back within 48 hours. If the venue accepts, you&apos;ll have 24 hours to pay and lock in the booking.
                </motion.p>
                <motion.div
                  className="mt-6 rounded-2xl border border-foreground/12 bg-card p-4 text-left text-sm"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.36, duration: 0.4 }}
                >
                  <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Request reference</span><strong className="font-mono text-xs">{requestId.slice(0, 8).toUpperCase()}</strong></div>
                </motion.div>
                <motion.div
                  className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.44, duration: 0.4 }}
                >
                  <Link href="/bookings" className={venueButton.primary}>Track my request <VenueIcon name="arrow" className="size-4" /></Link><button type="button" onClick={onClose} className={venueButton.outline}>Back to venue</button>
                </motion.div>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="px-5 pt-5 sm:px-7">
                  <div className="grid grid-cols-3 gap-2" aria-label={`Step ${step} of 3`}>
                    {["Event", "Your details", "Confirm"].map((label, index) => <div key={label}><div className={`h-1 rounded-full ${index + 1 <= step ? "bg-primary" : "bg-muted"}`} /><span className={`mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] ${index + 1 === step ? "text-foreground" : "text-muted-foreground"}`}>{index + 1}. {label}</span></div>)}
                  </div>
                </div>
                <div className="px-5 py-7 sm:px-7">
                  <AnimatePresence mode="wait" initial={false}>
                    {step === 1 && <motion.div key="event" initial={reduceMotion ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2"><label>{fieldLabel("Date")}<input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} className={inputClass} /></label><label>{fieldLabel("Start time")}<input type="time" value={form.time} onChange={(event) => update("time", event.target.value)} className={inputClass} /></label></div>
                      <div className="grid gap-4 sm:grid-cols-2"><label>{fieldLabel("Duration")}<select value={form.duration} onChange={(event) => update("duration", Number(event.target.value))} className={inputClass}>{[1,2,3,4,5,6].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>)}</select></label><label>{fieldLabel("Expected people")}<input type="number" min="1" max={space.maxGuests} value={form.people} onKeyDown={preventWheelChange} onChange={(event) => update("people", Number(event.target.value))} className={inputClass} /><span className="mt-1.5 block text-xs text-muted-foreground">Maximum {space.maxGuests}. Please count guests, speakers, and crew.</span></label></div>
                      <label className="block">{fieldLabel("What are you hosting?")}<select value={form.eventType} onChange={(event) => update("eventType", event.target.value as VenueEventType)} className={inputClass}>{VENUE_EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
                      <label className="block">{fieldLabel("Describe your event")}<textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} placeholder="Who is it for, what will happen, and what setup will you need?" className={`${inputClass} py-3`} /><span className="mt-1.5 block text-xs text-muted-foreground">{TIME_CAFE.name} reads this before accepting your request.</span></label>
                      <div className="rounded-2xl bg-warn/10 p-4 text-sm leading-6 text-warn-ink"><strong>Plan for your full crowd.</strong> Include speakers, crew, and plus-ones in the guest count. If the number changes later, check with the venue first.</div>
                    </motion.div>}

                    {step === 2 && <motion.div key="profile" initial={reduceMotion ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2"><label>{fieldLabel("Full name")}<input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" className={inputClass} /></label><label>{fieldLabel("Email")}<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" className={inputClass} /></label></div>
                      <label className="block">{fieldLabel("Mobile number")}<input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" className={inputClass} /><span className="mt-2 block text-xs text-muted-foreground">The host contacts you on this number about your request.</span></label>
                      <div className="grid gap-3 sm:grid-cols-[.75fr_1.25fr]"><label>{fieldLabel("Profile type")}<select value={form.trustType} onChange={(event) => update("trustType", event.target.value as FormState["trustType"])} className={inputClass}><option>LinkedIn</option><option>Instagram</option><option>Website</option></select></label><label>{fieldLabel(`${form.trustType} link`)}<input type="url" value={form.trustUrl} onChange={(event) => update("trustUrl", event.target.value)} placeholder="https://" className={inputClass} /></label></div>
                      <p className="-mt-3 text-xs text-muted-foreground">A profile helps the venue know who&apos;s organising.</p>
                      <fieldset className="space-y-3 rounded-2xl border border-foreground/12 bg-card p-4"><legend className="px-1 text-sm font-bold">Send me updates</legend><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={form.whatsappOptIn} onChange={(event) => update("whatsappOptIn", event.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span>WhatsApp</span></label><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={form.emailOptIn} onChange={(event) => update("emailOptIn", event.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span>Email</span></label></fieldset>
                    </motion.div>}

                    {step === 3 && <motion.div key="review" initial={reduceMotion ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                      <div className="overflow-hidden rounded-2xl border border-foreground/12 bg-card"><div className="border-b border-foreground/12 p-5"><VenueKicker>Your request</VenueKicker><h3 className="mt-1 font-display text-2xl font-black">{space.name}</h3><p className="mt-1 text-sm text-muted-foreground">{TIME_CAFE.name} · {TIME_CAFE.area}</p></div><dl className="grid grid-cols-2 gap-px bg-foreground/10 text-sm"><div className="bg-card p-4"><dt className="text-xs text-muted-foreground">When</dt><dd className="mt-1 font-bold">{form.date}<br />{form.time} · {form.duration}h</dd></div><div className="bg-card p-4"><dt className="text-xs text-muted-foreground">Event</dt><dd className="mt-1 font-bold">{form.eventType}<br />{form.people} people</dd></div></dl></div>
                      <div className="rounded-2xl bg-foreground p-5 text-background"><div className="flex items-end justify-between gap-4"><div><p className="text-xs text-background/55">Estimated total</p><p className="mt-1 font-display text-3xl font-black">{total === null ? "Host quote" : formatRupees(total)}</p></div><span className="rounded-full border border-background/20 px-3 py-1.5 text-xs">Nothing to pay today</span></div><p className="mt-3 text-xs leading-5 text-background/55">Pay only if {TIME_CAFE.name} accepts. You&apos;ll have 24 hours to confirm the booking.</p></div>
                      {space.minimumFoodSpend && <div className="rounded-2xl border border-foreground/12 p-4 text-sm leading-6">Prefer to spend on food instead? Ask the host whether a {formatRupees(space.minimumFoodSpend)} minimum order can replace the hourly rent.</div>}
                      <label className="flex items-start gap-3 rounded-2xl border border-foreground/12 bg-card p-4 text-sm leading-6"><input type="checkbox" checked={form.agreedToPolicies} onChange={(event) => update("agreedToPolicies", event.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]" /><span>I agree to the venue&apos;s house rules, cancellation terms, and guest limit.</span></label>
                    </motion.div>}
                  </AnimatePresence>
                  {error && <p role="alert" className="mt-5 rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary-ink">{error}</p>}
                </div>
                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-foreground/12 bg-[#f7f5ee]/95 px-5 py-4 backdrop-blur sm:px-7">
                  <button type="button" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)} className={venueButton.outline}>{step === 1 ? "Cancel" : "Back"}</button>
                  {step < 3 ? <button type="button" onClick={next} className={venueButton.primary}>Continue <VenueIcon name="arrow" className="size-4" /></button> : <button type="submit" className={venueButton.primary}>Request this space <VenueIcon name="arrow" className="size-4" /></button>}
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

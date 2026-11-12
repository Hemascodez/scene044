"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Profile } from "@/components/venues/figma/AuthModal";
import { attendeePhone, httpAttendeeAuth, pastedOtp, type AttendeeAuthApi } from "@/lib/client/attendeeAuth";
import { formatIndianMobile, type RegistrationDetails } from "@/lib/client/eventRegistration";
import { EventFlowDialog } from "@/components/scene/hosted/EventFlowDialog";

const fieldClass = "mt-2 block min-h-12 w-full border border-white/20 bg-white/5 px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6a55] disabled:opacity-60";
const buttonClass = "mt-4 flex min-h-12 w-full items-center justify-center bg-[#c41b09] px-4 py-3 font-mono text-sm font-bold text-white hover:bg-[#df2d16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60";
type Saved = Pick<Profile, "name" | "phone" | "email">;

/** One details form and one paste/autofill-friendly OTP field; no venue or host-role controls. */
export function AttendeeForm({ saved, initialDetails, price, eventTitle, termsHref, auth = httpAttendeeAuth, onReady, error: parentError }: {
  saved: Saved | null;
  initialDetails?: RegistrationDetails;
  price?: string;
  eventTitle?: string;
  termsHref?: string;
  auth?: AttendeeAuthApi;
  error?: string | null;
  onReady: (details: RegistrationDetails, whatsappOptIn: boolean, verified?: Profile) => void | Promise<void>;
}) {
  const id = useId();
  const [name, setName] = useState(saved?.name ?? initialDetails?.name ?? "");
  const [email, setEmail] = useState(saved?.email ?? initialDetails?.email ?? "");
  const [phone, setPhone] = useState(attendeePhone(saved?.phone ?? initialDetails?.phone ?? "") ?? "");
  const [verifiedPhone, setVerifiedPhone] = useState(attendeePhone(saved?.phone ?? ""));
  const [step, setStep] = useState<"details" | "otp">("details");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (step !== "otp") return;
    const timer = setTimeout(() => codeRef.current?.focus(), 100);
    const countdown = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => { clearTimeout(timer); clearInterval(countdown); };
  }, [step, deadline]);
  const number = attendeePhone(phone);
  async function sendCode() {
    if (!number) throw new Error("Enter a valid 10-digit Indian mobile number.");
    await auth.send(number);
    if (!mounted.current) return;
    setDeadline(Date.now() + 60_000); setRemaining(60); setCode(""); setStep("otp");
  }
  async function submit() {
    if (busy) return;
    setError("");
    if (name.trim().length < 2 || name.trim().length > 120) { setError("Enter your name (at least two characters)."); document.getElementById(`${id}-name`)?.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 300) { setError("Enter a valid email address."); document.getElementById(`${id}-email`)?.focus(); return; }
    if (!number) { setError("Enter a valid 10-digit Indian mobile number."); document.getElementById(`${id}-phone`)?.focus(); return; }
    setBusy(true);
    try {
      const details = { name: name.trim(), email: email.trim(), phone: number };
      if (verifiedPhone === number) await onReady(details, whatsappOptIn);
      else if (step === "details") await sendCode();
      else {
        if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit code from WhatsApp.");
        const profile = await auth.verify(details, code);
        if (!mounted.current) return;
        setVerifiedPhone(number);
        await onReady(details, whatsappOptIn, profile);
      }
    } catch (e) {
      if (mounted.current) { setError(e instanceof Error ? e.message : "Something went wrong. Try again."); requestAnimationFrame(() => (step === "otp" ? codeRef.current : errorRef.current)?.focus()); }
    } finally { if (mounted.current) setBusy(false); }
  }
  async function resend() {
    if (busy || remaining > 0) return;
    setBusy(true); setError("");
    try { await sendCode(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Couldn't resend. Try again."); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <form noValidate onSubmit={e => { e.preventDefault(); void submit(); }}>
    {eventTitle && <p className="mb-3 text-sm text-muted-foreground">{eventTitle}{price && <strong className="ml-2 text-foreground">{price}</strong>}</p>}
    {step === "details" ? <>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{verifiedPhone === number && number ? "Confirm your details to continue." : "Enter your details. We'll send a code to your WhatsApp."}</p>
      <div className="space-y-4">
        <label htmlFor={`${id}-name`} className="block text-sm font-semibold">Name<input id={`${id}-name`} name="name" autoComplete="name" maxLength={120} required value={name} disabled={busy} onChange={e => setName(e.target.value)} className={fieldClass} /></label>
        <label htmlFor={`${id}-email`} className="block text-sm font-semibold">Email<input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={300} required placeholder="you@example.com" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} className={fieldClass} /></label>
        <label htmlFor={`${id}-phone`} className="block text-sm font-semibold">WhatsApp number <span className="font-normal text-muted-foreground">(+91)</span><input id={`${id}-phone`} name="tel" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={30} required placeholder="98765 43210" value={phone} disabled={busy} onChange={e => setPhone(e.target.value)} onBlur={() => { if (number) setPhone(number); }} className={fieldClass} /></label>
      </div>
      {price && <label className="mt-3 flex min-h-11 items-start gap-3 py-2 text-sm leading-relaxed text-muted-foreground"><input type="checkbox" checked={whatsappOptIn} disabled={busy} onChange={e => setWhatsappOptIn(e.target.checked)} className="mt-1 size-[18px] shrink-0 accent-[#c41b09]" /><span>Send my ticket and event reminders on WhatsApp <span className="whitespace-nowrap">(optional).</span> Your ticket is always in My bookings.</span></label>}
    </> : <>
      <p className="text-sm leading-relaxed text-muted-foreground">Enter the code sent to <strong className="text-foreground">{formatIndianMobile(phone)}</strong>.</p>
      <button type="button" disabled={busy} onClick={() => { setStep("details"); setCode(""); setError(""); }} className="mb-3 inline-flex min-h-11 items-center text-sm text-[#ff8a77] underline underline-offset-4">Change number</button>
      <label htmlFor={`${id}-code`} className="block text-sm font-semibold">Six-digit WhatsApp code</label>
      <input ref={codeRef} id={`${id}-code`} name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={6} pattern="[0-9]{6}" value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onPaste={e => { const pasted = pastedOtp(e.clipboardData.getData("text")); if (pasted) { e.preventDefault(); setCode(pasted); } }} aria-describedby={`${id}-otp-hint${error ? ` ${id}-error` : ""}`} className={`${fieldClass} text-center text-2xl tracking-[0.3em]`} />
      <p id={`${id}-otp-hint`} className="mt-2 text-xs leading-relaxed text-muted-foreground">You can paste the whole code or use your phone&apos;s autofill.</p>
    </>}
    {(error || parentError) && <p ref={errorRef} id={`${id}-error`} role="alert" tabIndex={-1} className="mt-3 border-l-2 border-[#ff6a55] px-3 text-sm text-[#ffb2a4]">{error || parentError}</p>}
    <button type="submit" disabled={busy} aria-busy={busy} className={buttonClass}>{busy ? (step === "otp" ? "Verifying…" : "Please wait…") : verifiedPhone === number && number ? (price ? `Continue to pay ${price}` : "Continue") : step === "details" ? "Send WhatsApp code" : price ? `Verify & pay ${price}` : "Verify & sign in"}</button>
    {step === "otp" && <button type="button" disabled={busy || remaining > 0} onClick={() => void resend()} className="mt-2 min-h-11 w-full text-sm text-muted-foreground underline underline-offset-4 disabled:no-underline">{remaining > 0 ? `Resend code in ${remaining}s` : "Resend WhatsApp code"}</button>}
    {price && termsHref && <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">By paying, you agree to the <a href={termsHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">event terms &amp; refund policy</a>.</p>}
  </form>;
}

export function AttendeeAuthDialog({ open, saved, onClose, onVerified }: { open: boolean; saved: Profile | null; onClose: () => void; onVerified: (profile: Profile) => void }) {
  return <EventFlowDialog open={open} title="Sign in to SCENE" onClose={onClose}>{open && <AttendeeForm saved={saved} onReady={(details, _, verified) => { if (verified) onVerified(verified); else if (saved) onVerified({ ...saved, ...details }); }} />}</EventFlowDialog>;
}

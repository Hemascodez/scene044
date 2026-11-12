"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Profile } from "@/components/venues/figma/AuthModal";
import { RegistrationError, clearStoredTicketToken, readStoredTicketToken, storeTicketToken, type CreatedRegistration, type RegistrationDetails } from "@/lib/client/eventRegistration";
import { mockAttendeeAuth } from "@/lib/client/attendeeAuth";
import { eventTicketLocation } from "@/lib/eventTicketLocation";
import { eventPath } from "@/lib/seo";
import { fetchMyEventTickets } from "@/lib/client/myEventTickets";
import { openRazorpayCheckout, type RazorpaySuccessResponse } from "@/lib/client/razorpay";
import { flowReducer, initialFlow } from "@/lib/client/registrationFlow";
import { formatRupees, seatSummary, type HostedEventDetail } from "@/lib/hostedEvents";
import { REGISTER_OPEN_EVENT, RegisterBar } from "./RegisterBar";
import { useHostedAuth } from "./hostedAuth";
import { useHostedSeatStats } from "./HostedSeatStats";
import { ReaderPass } from "./ReaderPass";
import { AttendeeForm } from "./AttendeeForm";
import { EventFlowDialog } from "./EventFlowDialog";

const action = "mt-4 min-h-12 w-full border border-white/20 bg-[#c41b09] px-4 py-3 font-mono text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60";

/** One attendee popup → OTP → the real Razorpay sheet → a separate, verified ticket page. */
export function HostedRegistration({ event, api: apiKind, anchorId }: { event: HostedEventDetail; api: "http" | "mock"; anchorId: string }) {
  const { hosted, api, refresh } = useHostedSeatStats();
  const { profile, acceptVerifiedProfile } = useHostedAuth();
  const seat = seatSummary(hosted, event.endAt, undefined, event.status);
  const price = formatRupees(hosted.pricePaise);
  const [state, dispatch] = useReducer(flowReducer, seat, s => initialFlow(s, null));
  const [open, setOpen] = useState(false);
  const [forceOtp, setForceOtp] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [existingToken, setExistingToken] = useState<string | null>(null);
  const [checkingTicket, setCheckingTicket] = useState(true);
  const creating = useRef(false);
  const checkout = useRef(false);
  const verifying = useRef(false);
  const attempt = useRef(0);
  const paymentRef = useRef<RazorpaySuccessResponse | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { dispatch({ type: "seat_changed", state: seat.state }); }, [seat.state]);

  const ticketHref = useCallback((token: string, fresh = false) => {
    const path = apiKind === "mock" ? `/dev/hosted-ticket?ticket=${encodeURIComponent(token)}` : eventTicketLocation(event, token);
    return path + (fresh ? "&new=1" : "");
  }, [apiKind, event]);
  function openTicket(token: string, fresh = false) {
    // Full navigation prevents analytics on the previous public page seeing a bearer URL.
    window.location.assign(ticketHref(token, fresh));
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      if (apiKind === "http") {
        // Only the authenticated account's registration counts as "you're
        // registered". Browser storage is not proof of ownership on a shared device.
        try {
          const own = (await fetchMyEventTickets()).find(t => t.eventId === event.id && t.ticket.status === "confirmed");
          if (active) setExistingToken(own?.ticketToken ?? null);
        } catch { /* Server create still protects against duplicate payments. */ }
      } else {
        const token = readStoredTicketToken(event.id);
        if (token) {
        try {
          const ticket = await api.getTicket(token);
          if (ticket?.status === "confirmed") { if (active) setExistingToken(token); }
          else if (readStoredTicketToken(event.id) === token) clearStoredTicketToken(event.id);
        } catch { /* Keep the private token during network trouble; API still guards duplicates. */ }
        }
      }
      if (active) setCheckingTicket(false);
    })();
    return () => { active = false; };
  }, [api, apiKind, event.id, profile?.phone]);

  const startRegistration = useCallback(() => {
    if (existingToken) { window.location.assign(ticketHref(existingToken)); return; }
    if (state.busy || (seat.state !== "open" && !state.registration)) return;
    if (state.step === "idle") dispatch({ type: "prefill", details: { name: profile?.name ?? "", email: profile?.email ?? "", phone: profile?.phone ?? "" } });
    setOpen(true);
  }, [existingToken, ticketHref, profile, state.busy, state.step, state.registration, seat.state]);
  useEffect(() => {
    window.addEventListener(REGISTER_OPEN_EVENT, startRegistration);
    return () => window.removeEventListener(REGISTER_OPEN_EVENT, startRegistration);
  }, [startRegistration]);

  function closeDialog() { attempt.current++; setOpen(false); }

  async function ready(details: RegistrationDetails, whatsappOptIn: boolean, verified?: Profile) {
    if (creating.current || checkout.current || verifying.current) return;
    if (verified) { acceptVerifiedProfile(verified); setForceOtp(false); }
    creating.current = true;
    const current = attempt.current;
    dispatch({ type: "prefill", details });
    dispatch({ type: "busy", busy: true });
    try {
      // Session phone and amount are authoritative on the server, never client-submitted.
      const registration = await api.create({ name: details.name, email: details.email, whatsappOptIn });
      if (!mounted.current) return;
      dispatch({ type: "registration_created", registration });
      if (current === attempt.current) void pay(registration, details);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof RegistrationError && error.status === 401) {
        setForceOtp(true); setFormVersion(n => n + 1);
        dispatch({ type: "error", message: "Your sign-in expired. Verify your WhatsApp number again to continue." });
      } else if (error instanceof RegistrationError && error.soldOut) {
        dispatch({ type: "sold_out" }); void refresh();
      } else if (error instanceof RegistrationError && error.existingTicketToken) {
        storeTicketToken(event.id, error.existingTicketToken);
        openTicket(error.existingTicketToken);
      } else dispatch({ type: "error", message: error instanceof Error ? error.message : "Couldn't start payment. Try again." });
    } finally { creating.current = false; }
  }

  async function confirmPaymentWith(registrationToken: string, payment: RazorpaySuccessResponse) {
    if (verifying.current) return;
    verifying.current = true;
    dispatch({ type: "busy", busy: true });
    try {
      const { ticket, ticketToken } = await api.verify({ registrationToken, ...payment });
      storeTicketToken(event.id, ticketToken);
      dispatch({ type: "confirmed", ticket });
      void refresh();
      openTicket(ticketToken, true);
    } catch (error) {
      dispatch({ type: "verify_failed", message: error instanceof Error ? error.message : "Network" });
      setOpen(true);
    } finally { verifying.current = false; }
  }

  async function pay(registration: CreatedRegistration, details = state.details) {
    if (checkout.current || verifying.current) return;
    checkout.current = true;
    dispatch({ type: "busy", busy: true });
    // Remove the form's focus trap before the provider opens its own payment dialog.
    setOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const onSuccess = (response: RazorpaySuccessResponse) => {
      checkout.current = false;
      paymentRef.current = response;
      dispatch({ type: "payment_succeeded", paymentId: response.razorpay_payment_id });
      void confirmPaymentWith(registration.registrationToken, response);
    };
    let failureMessage: string | null = null;
    const onDismiss = () => {
      checkout.current = false;
      if (paymentRef.current) return;
      if (failureMessage) dispatch({ type: "payment_failed", message: failureMessage });
      else dispatch({ type: "payment_dismissed" });
      setOpen(true);
    };
    // Razorpay may keep its sheet open for another payment attempt after failure.
    // Do not open our focus-trapped dialog over the provider's retry screen.
    const onFailed = (message: string) => { failureMessage = message; };
    // Let the closing popup release focus and the mobile keyboard before checkout.
    await new Promise<void>(resolve => window.setTimeout(resolve, 220));
    if (!mounted.current) { checkout.current = false; return; }
    if (apiKind === "mock") {
      if (window.confirm(`LOCAL PREVIEW ONLY: simulate payment of ${price}?\nOK = simulate success, Cancel = dismiss. No real charge.`)) onSuccess({ razorpay_order_id: registration.orderId, razorpay_payment_id: "pay_mock", razorpay_signature: "sig_mock" });
      else onDismiss();
      return;
    }
    try {
      await openRazorpayCheckout({ keyId: registration.keyId, orderId: registration.orderId, amount: registration.amount, currency: registration.currency, name: "SCENE", description: event.title, prefill: { name: details.name, email: details.email, contact: details.phone }, onSuccess, onDismiss, onFailed });
    } catch (error) { onFailed(error instanceof Error ? error.message : "Couldn't open payment. Try again."); onDismiss(); }
  }

  const canRegister = ["idle", "details", "paying", "confirming"].includes(state.step);
  return <>
    <section id={anchorId} aria-labelledby="hosted-registration-title" className="scroll-mt-20">
      <h2 id="hosted-registration-title" className="sr-only">Registration</h2>
      {existingToken ? <div className="border border-white/20 bg-card p-5"><p className="font-display text-xl font-bold">You’re registered</p><a href={ticketHref(existingToken)} className={`${action} inline-flex items-center justify-center`}>View your ticket</a></div>
        : canRegister ? <>
          <ReaderPass hosted={hosted} onSwipe={startRegistration} />
          {state.step !== "idle" && state.step !== "details" && <button type="button" onClick={startRegistration} className={action} disabled={state.busy}>{state.step === "confirming" ? "Continue payment confirmation" : state.busy ? "Opening payment…" : "Continue payment"}</button>}
        </> : <div className="border border-white/20 bg-card p-5"><p className="font-display text-2xl font-black">{seat.label}</p><p className="mt-2 text-sm text-muted-foreground">{state.step === "sold_out" ? "Every seat is taken. Turn on alerts below to hear about the next session." : "Registration isn't open right now."}</p></div>}
    </section>
    <EventFlowDialog open={open} title={state.step === "paying" ? "Complete your booking" : state.step === "confirming" ? "Confirming your payment" : "Get your reader pass"} onClose={closeDialog}>
      {open && state.step === "details" && <AttendeeForm key={formVersion} saved={forceOtp ? null : profile} initialDetails={state.details} price={price} eventTitle={event.title} termsHref={`${eventPath(event)}#terms`} auth={apiKind === "mock" ? mockAttendeeAuth : undefined} error={state.message} onReady={ready} />}
      {state.step === "paying" && <><p className="text-sm leading-relaxed">Your reader pass is {price}. Finish payment to confirm your place.</p>{state.message && <p role="alert" className="mt-3 text-sm text-[#ffb2a4]">{state.message}</p>}<button type="button" className={action} disabled={state.busy} onClick={() => { if (state.registration) void pay(state.registration); }}>{state.busy ? "Opening payment…" : `Pay ${price} with Razorpay`}</button><p className="mt-3 text-xs text-muted-foreground">UPI, cards and other methods supported by Razorpay.</p></>}
      {state.step === "confirming" && <div role="status"><p className="text-sm leading-relaxed">{state.message ?? "Verifying your payment. Your ticket will open on its own page once confirmed."}</p>{state.message && <button type="button" className={action} disabled={state.busy} onClick={() => { if (state.registration && paymentRef.current) void confirmPaymentWith(state.registration.registrationToken, paymentRef.current); }}>{state.busy ? "Retrying…" : "Retry confirmation — do not pay again"}</button>}</div>}
      {state.step === "sold_out" && <p>Sorry, the remaining seats were just taken. You haven&apos;t been charged.</p>}
    </EventFlowDialog>
    <RegisterBar anchorId={anchorId} priceLabel={price} hidden={checkingTicket || open || state.busy || !canRegister || Boolean(existingToken)} />
  </>;
}

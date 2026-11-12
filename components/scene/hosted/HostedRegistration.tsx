"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import {
  RegistrationError,
  clearStoredTicketToken,
  formatIndianMobile,
  httpRegistrationApi,
  mockRegistrationApi,
  readStoredTicketToken,
  storeTicketToken,
  validateDetails,
  type RegistrationApi,
  type Ticket,
} from "@/lib/client/eventRegistration";
import { formatSceneDateLong } from "@/lib/client/istTime";
import { PRINT_TIMING, playTicketPrint, primeTicketSound } from "@/lib/client/ticketSound";
import { TicketPrinter } from "@/components/scene/hosted/TicketPrinter";
import { openRazorpayCheckout, type RazorpaySuccessResponse } from "@/lib/client/razorpay";
import { flowReducer, initialFlow, type FlowStep } from "@/lib/client/registrationFlow";
import { formatRupees, seatSummary, type HostedEventDetail } from "@/lib/hostedEvents";
import { Btn, Mono } from "@/components/scene/ui";
import { REGISTER_OPEN_EVENT, RegisterBar } from "@/components/scene/hosted/RegisterBar";
import { TicketView } from "@/components/scene/hosted/TicketView";
import { useHostedAuth } from "@/components/scene/hosted/hostedAuth";
import { PassFooter, ReaderPass, SwipeToPay } from "@/components/scene/hosted/ReaderPass";


const inputClass =
  "mt-1 block min-h-11 w-full border-2 border-foreground bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary aria-[invalid=true]:border-primary-ink disabled:opacity-60";
const labelClass = "font-mono text-[10px] font-semibold uppercase tracking-[0.12em]";

/** Groups steps that share one panel, so the panel only animates on real changes. */
function panelOf(step: FlowStep): string {
  if (step === "details") return "form";
  // Same panel, so the ticket printer carries on from printing to printed.
  if (step === "confirming" || step === "confirmed") return "ticket";
  return step;
}

/**
 * The ticket printer while the payment is confirmed, then the printed ticket,
 * then the real ticket (QR, calendar) fading in underneath. Rendered in both
 * the confirming and confirmed steps so React keeps the same printer on screen.
 */
function CelebrationPanel({
  phase,
  event,
  guestName,
  ticket,
}: {
  phase: "printing" | "printed";
  event: HostedEventDetail;
  guestName: string;
  ticket: Ticket | null;
}) {
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (phase !== "printed") return;
    const delay = reduceMotion ? 0 : PRINT_TIMING.feedMs + PRINT_TIMING.settleMs + 500;
    const timer = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(timer);
  }, [phase, reduceMotion]);

  return (
    <div>
      <p role="status" aria-live="polite" className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-ink">
        {phase === "printing" ? "Confirming your payment…" : <span className="text-signal-ink">Payment successful · ticket printed</span>}
      </p>
      <TicketPrinter
        phase={phase}
        eventTitle={event.title}
        guestName={guestName}
        eventDate={event.startAt ? formatSceneDateLong(event.startAt) : "Date to be announced"}
      />
      {revealed && ticket && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className="mt-2">
          <TicketView ticket={ticket} event={event} />
        </motion.div>
      )}
    </div>
  );
}

export function HostedRegistration({
  event,
  api: apiKind,
  anchorId,
}: {
  event: HostedEventDetail;
  api: "http" | "mock";
  anchorId: string;
}) {
  const hosted = event.hosted;
  const seat = seatSummary(hosted, event.endAt);
  const price = formatRupees(hosted.pricePaise);
  const api: RegistrationApi = useMemo(
    () => (apiKind === "mock" ? mockRegistrationApi() : httpRegistrationApi(event.id)),
    [apiKind, event.id],
  );

  const [state, dispatch] = useReducer(flowReducer, seat, (s) => initialFlow(s, null));
  const [checkingTicket, setCheckingTicket] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const { requireAuth } = useHostedAuth();
  const paymentRef = useRef<RazorpaySuccessResponse | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /** Swipe or the phone bar: sign in if needed, then open the details. */
  const startRegistration = useCallback(() => {
    requireAuth((profile) => {
      dispatch({ type: "prefill", details: { name: profile.name, email: profile.email ?? "", phone: profile.phone } });
      setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 250);
    });
  }, [requireAuth]);

  const showTicket = useCallback(
    async (token: string) => {
      const ticket = await api.getTicket(token);
      if (ticket?.status === "confirmed") {
        storeTicketToken(event.id, token);
        dispatch({ type: "confirmed", ticket });
        return true;
      }
      clearStoredTicketToken(event.id);
      return false;
    },
    [api, event.id],
  );

  // A returning guest (WhatsApp link ?ticket=… or this device) sees their ticket.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ticket");
    const token = fromUrl || readStoredTicketToken(event.id);
    void (async () => {
      if (token) {
        // Offline or server error: keep the stored token, show the normal card.
        await showTicket(token).catch(() => false);
      }
      setCheckingTicket(false);
    })();
  }, [event.id, showTicket]);

  // The phone bar asks the card to open.
  useEffect(() => {
    window.addEventListener(REGISTER_OPEN_EVENT, startRegistration);
    return () => window.removeEventListener(REGISTER_OPEN_EVENT, startRegistration);
  }, [startRegistration]);

  // The ticket printer's sound, once, when a ticket was just paid for here.
  const playedRef = useRef(false);
  useEffect(() => {
    if (state.step !== "confirmed" || !state.celebrate || playedRef.current) return;
    playedRef.current = true;
    playTicketPrint();
  }, [state.step, state.celebrate]);

  const errors = validateDetails(state.details);
  const visibleErrors = showErrors ? errors : {};

  function edit(field: "name" | "email", value: string) {
    dispatch({ type: "edit", field, value });
  }

  async function continueToPay() {
    setShowErrors(true);
    const firstInvalid = (["name", "email"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(`reg-${firstInvalid}`)?.focus();
      return;
    }
    primeTicketSound();
    dispatch({ type: "busy", busy: true });
    try {
      const registration = await api.create({ name: state.details.name, email: state.details.email });
      dispatch({ type: "registration_created", registration });
      void pay(registration);
    } catch (error) {
      if (error instanceof RegistrationError && error.status === 401) {
        dispatch({ type: "error", message: "Your sign-in expired. Sign in again to continue." });
        startRegistration();
      } else if (error instanceof RegistrationError && error.soldOut) {
        dispatch({ type: "sold_out" });
      } else if (error instanceof RegistrationError && error.existingTicketToken) {
        const shown = await showTicket(error.existingTicketToken).catch(() => false);
        if (!shown) dispatch({ type: "error", message: error.message });
      } else {
        dispatch({ type: "error", message: error instanceof Error ? error.message : "Something went wrong. Try again." });
      }
    }
  }

  function retryConfirmation() {
    const payment = paymentRef.current;
    if (!state.registration || !payment) return;
    dispatch({ type: "busy", busy: true });
    void confirmPaymentWith(state.registration.registrationToken, payment);
  }

  async function pay(registration = state.registration) {
    if (!registration) return;
    dispatch({ type: "busy", busy: true });
    const onSuccess = (response: RazorpaySuccessResponse) => {
      paymentRef.current = response;
      dispatch({ type: "payment_succeeded", paymentId: response.razorpay_payment_id });
      void confirmPaymentWith(registration.registrationToken, response);
    };

    if (apiKind === "mock") {
      // Dev preview only: stand-in for the Razorpay sheet.
      setTimeout(() => {
        if (window.confirm(`Mock Razorpay: pay ${price}?\nOK = pay, Cancel = close the sheet`)) {
          onSuccess({ razorpay_order_id: registration.orderId, razorpay_payment_id: "pay_mock", razorpay_signature: "sig_mock" });
        } else {
          dispatch({ type: "payment_dismissed" });
        }
      }, 50);
      return;
    }

    try {
      await openRazorpayCheckout({
        keyId: registration.keyId,
        orderId: registration.orderId,
        amount: registration.amount,
        currency: registration.currency,
        name: "SCENE/044",
        description: event.title,
        prefill: { name: state.details.name, email: state.details.email, contact: state.details.phone },
        onSuccess,
        onDismiss: () => dispatch({ type: "payment_dismissed" }),
        onFailed: (message) => dispatch({ type: "payment_failed", message }),
      });
    } catch (error) {
      dispatch({ type: "payment_failed", message: error instanceof Error ? error.message : "Couldn't open payment. Try again." });
    }
  }

  async function confirmPaymentWith(registrationToken: string, payment: RazorpaySuccessResponse) {
    try {
      const { ticket, ticketToken } = await api.verify({ registrationToken, ...payment });
      storeTicketToken(event.id, ticketToken);
      dispatch({ type: "confirmed", ticket });
    } catch (error) {
      dispatch({ type: "verify_failed", message: error instanceof Error ? error.message : "Network" });
    }
  }

  const barHidden = checkingTicket || state.step !== "idle";

  return (
    <MotionConfig reducedMotion="user">
      <section
        id={anchorId}
        aria-labelledby="hosted-registration-title"
        className="scroll-mt-20 border-2 border-foreground bg-card p-4 shadow-[5px_5px_0_0_var(--color-foreground)] sm:p-6"
      >
        <h2 id="hosted-registration-title" className="sr-only">
          Registration
        </h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={checkingTicket ? "checking" : panelOf(state.step)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {checkingTicket ? (
              <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Checking for your ticket…
              </p>
            ) : state.step === "confirmed" && state.ticket ? (
              state.celebrate ? (
                <CelebrationPanel phase="printed" event={event} guestName={state.ticket.name} ticket={state.ticket} />
              ) : (
                <TicketView ticket={state.ticket} event={event} />
              )
            ) : state.step === "confirming" && !state.message ? (
              <CelebrationPanel phase="printing" event={event} guestName={state.details.name} ticket={null} />
            ) : state.step === "idle" ? (
              <ReaderPass
                hosted={hosted}
                onSwipe={startRegistration}
              />
            ) : state.step === "details" ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void continueToPay();
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Mono className="text-[10px] text-primary-ink">Your details</Mono>
                  <span className="font-display text-lg font-black">{price}</span>
                </div>

                <Field id="reg-name" label="Name" error={visibleErrors.name}>
                  <input
                    ref={nameRef}
                    id="reg-name"
                    name="name"
                    autoComplete="name"
                    value={state.details.name}
                    onChange={(e) => edit("name", e.target.value)}
                    aria-invalid={Boolean(visibleErrors.name)}
                    aria-describedby={visibleErrors.name ? "reg-name-error" : undefined}
                    className={inputClass}
                  />
                </Field>

                <Field id="reg-email" label="Email" error={visibleErrors.email}>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={state.details.email}
                    onChange={(e) => edit("email", e.target.value)}
                    aria-invalid={Boolean(visibleErrors.email)}
                    aria-describedby={visibleErrors.email ? "reg-email-error" : undefined}
                    className={inputClass}
                  />
                </Field>

                <p className="mt-3 border-2 border-foreground bg-secondary px-3 py-2 text-sm">
                  <span className={labelClass}>WhatsApp</span>{" "}
                  <span className="font-mono">{formatIndianMobile(state.details.phone)}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Your ticket and reminders come here.</span>
                </p>

                <FlowMessage message={state.message} />

                <Btn type="submit" className="mt-4 min-h-12 w-full text-sm" disabled={state.busy}>
                  {state.busy ? "Starting payment…" : `Continue to pay ${price}`}
                </Btn>

                <TermsConsent />
              </form>
            ) : state.step === "paying" ? (
              <div>
                <Mono className="text-[10px] text-primary-ink">Payment</Mono>
                <p className="mt-1 text-sm">
                  Reader pass for <strong>{state.details.name}</strong>
                </p>
                <PriceRow price={price} seatLabel="Includes refreshments" />
                <FlowMessage message={state.message} />
                <div className="mt-5">
                  <SwipeToPay
                    label={`Swipe to pay ${price}`}
                    ariaLabel={`Swipe right, or press Enter, to pay ${price}`}
                    busy={state.busy}
                    onComplete={() => {
                      primeTicketSound();
                      void pay();
                    }}
                  />
                </div>
                <TermsConsent />
                <PassFooter />
              </div>
            ) : state.step === "confirming" ? (
              <div role="status" aria-live="polite">
                <Mono className="text-[10px] text-primary-ink">Payment received</Mono>
                <FlowMessage message={state.message} />
                <Btn className="mt-4 min-h-12 w-full text-sm" onClick={retryConfirmation} disabled={state.busy}>
                  {state.busy ? "Retrying…" : "Retry confirmation"}
                </Btn>
              </div>
            ) : (
              <ClosedState step={state.step} label={seat.label} />
            )}
          </motion.div>
        </AnimatePresence>
      </section>
      <RegisterBar anchorId={anchorId} priceLabel={price} hidden={barHidden} />
    </MotionConfig>
  );
}

function PriceRow({ price, seatLabel, lowSeats = false }: { price: string; seatLabel: string; lowSeats?: boolean }) {
  return (
    <div className="mt-2 flex items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Reader pass</p>
        <p className="font-display text-4xl font-black leading-none tracking-tight">{price}</p>
      </div>
      <p className={`text-right font-mono text-[11px] font-semibold uppercase tracking-[0.1em] ${lowSeats ? "text-warn-ink" : "text-muted-foreground"}`}>
        {seatLabel}
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-primary-ink">
          {error}
        </p>
      )}
    </div>
  );
}

function TermsConsent() {
  return (
    <p className="mt-3 text-center text-xs text-muted-foreground">
      By paying, you agree to the{" "}
      <a href="#terms" className="font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink">
        Terms &amp; conditions
      </a>
      .
    </p>
  );
}

function FlowMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 border-l-4 border-primary-ink bg-primary/10 px-3 py-2 text-sm">
      {message}
    </p>
  );
}

function ClosedState({ step, label }: { step: FlowStep; label: string }) {
  const body =
    step === "sold_out"
      ? "Every seat is taken. Turn on alerts below to hear about the next session first."
      : step === "ended"
        ? "Thanks to everyone who came. Turn on alerts below for the next one."
        : "Registration isn't open right now.";
  return (
    <div>
      <p className="font-display text-2xl font-black leading-tight tracking-tight">{label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

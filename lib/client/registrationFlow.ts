import type { CreatedRegistration, RegistrationDetails, Ticket } from "@/lib/client/eventRegistration";
import type { RegistrationState } from "@/lib/hostedEvents";

/**
 * The registration card's state machine, kept pure so every step can be
 * tested without a browser. The one rule it exists to enforce: nothing sets a
 * ticket except a `confirmed` action, which the card only dispatches after
 * the server verified the payment.
 */

export type FlowStep =
  | "idle"
  | "details"
  | "code_sent"
  | "paying"
  | "confirming"
  | "confirmed"
  | "sold_out"
  | "closed"
  | "ended";

export interface FlowState {
  step: FlowStep;
  details: RegistrationDetails;
  registration: CreatedRegistration | null;
  paymentId: string | null;
  ticket: Ticket | null;
  message: string | null;
  busy: boolean;
}

export type FlowAction =
  | { type: "open" }
  | { type: "edit"; field: keyof RegistrationDetails; value: string }
  | { type: "code_sent" }
  | { type: "registration_created"; registration: CreatedRegistration }
  | { type: "payment_dismissed" }
  | { type: "payment_failed"; message: string }
  | { type: "payment_succeeded"; paymentId: string }
  | { type: "verify_failed"; message: string }
  | { type: "confirmed"; ticket: Ticket }
  | { type: "sold_out" }
  | { type: "busy"; busy: boolean }
  | { type: "error"; message: string };

export function initialFlow(seat: { state: RegistrationState | "ended" }, ticket: Ticket | null): FlowState {
  const confirmed = ticket?.status === "confirmed" ? ticket : null;
  return {
    step: confirmed ? "confirmed" : seat.state === "open" ? "idle" : seat.state,
    details: { name: "", email: "", phone: "" },
    registration: null,
    paymentId: null,
    ticket: confirmed,
    message: null,
    busy: false,
  };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "open":
      return state.step === "idle" ? { ...state, step: "details", message: null } : state;
    case "edit": {
      const details = { ...state.details, [action.field]: action.value };
      // A new phone number needs a new code; anything already created for the
      // old number is dropped so the next payment is for the right person.
      const phoneChanged = action.field === "phone" && action.value !== state.details.phone;
      const backToDetails = phoneChanged && (state.step === "code_sent" || state.step === "paying");
      return {
        ...state,
        details,
        message: null,
        ...(backToDetails ? { step: "details" as const, registration: null } : {}),
      };
    }
    case "code_sent":
      return { ...state, step: "code_sent", busy: false, message: null };
    case "registration_created":
      return { ...state, step: "paying", registration: action.registration, busy: false, message: null };
    case "payment_dismissed":
      return { ...state, step: "paying", busy: false, message: "Payment not completed. Your details are saved — try again when ready." };
    case "payment_failed":
      return { ...state, step: "paying", busy: false, message: action.message };
    case "payment_succeeded":
      return { ...state, step: "confirming", paymentId: action.paymentId, busy: true, message: null };
    case "verify_failed":
      return {
        ...state,
        step: "confirming",
        busy: false,
        message: `We received your payment but couldn't confirm it yet. Retry, or message us with payment ID ${state.paymentId}.`,
      };
    case "confirmed":
      return { ...state, step: "confirmed", ticket: action.ticket, busy: false, message: null };
    case "sold_out":
      return { ...state, step: "sold_out", busy: false, message: null };
    case "busy":
      return { ...state, busy: action.busy, ...(action.busy ? { message: null } : {}) };
    case "error":
      return { ...state, busy: false, message: action.message };
  }
}

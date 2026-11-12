import assert from "node:assert/strict";
import { flowReducer, initialFlow, type FlowAction, type FlowState } from "../lib/client/registrationFlow";
import type { Ticket } from "../lib/client/eventRegistration";

const ticket: Ticket = { code: "SCN-READ-0101", name: "Asha", phoneMasked: "+91 ••••• 43210", status: "confirmed", qrValue: "t" };
const registration = { registrationToken: "r1", orderId: "order_1", amount: 29900, currency: "INR", keyId: "rzp_test" };

function run(state: FlowState, ...actions: FlowAction[]): FlowState {
  return actions.reduce(flowReducer, state);
}

// Load: a confirmed ticket wins; a cancelled one is ignored.
assert.equal(initialFlow({ state: "open" }, ticket).step, "confirmed");
assert.equal(initialFlow({ state: "sold_out" }, ticket).step, "confirmed", "a ticket holder still sees their ticket when sold out");
assert.equal(initialFlow({ state: "open" }, { ...ticket, status: "cancelled" }).step, "idle");
assert.equal(initialFlow({ state: "open" }, { ...ticket, status: "cancelled" }).ticket, null);
assert.equal(initialFlow({ state: "sold_out" }, null).step, "sold_out");
assert.equal(initialFlow({ state: "closed" }, null).step, "closed");
assert.equal(initialFlow({ state: "ended" }, null).step, "ended");

const start = initialFlow({ state: "open" }, null);

// Signed in (or just signed in): the account fills the details and opens them.
const account = { name: "Asha", email: "asha@example.com", phone: "+919876543210" };
const filled = run(start, { type: "prefill", details: account });
assert.equal(filled.step, "details");
assert.deepEqual(filled.details, account);
assert.equal(run(filled, { type: "prefill", details: { ...account, name: "Other" } }).details.name, "Other", "a later sign-in refreshes the details");
assert.equal(run(initialFlow({ state: "sold_out" }, null), { type: "prefill", details: account }).step, "sold_out", "prefill never reopens a closed card");

// Name and email stay editable; the phone belongs to the account.
const edited = run(filled, { type: "edit", field: "email", value: "asha@work.com" });
assert.equal(edited.details.email, "asha@work.com");
assert.equal(edited.details.phone, account.phone);

// Payment: dismissing or failing keeps the details and stays ready to pay.
let s = run(filled, { type: "registration_created", registration });
assert.equal(s.step, "paying");
s = run(s, { type: "payment_dismissed" });
assert.equal(s.step, "paying");
assert.equal(s.details.name, "Asha");
assert.equal(s.registration, registration);
assert.equal(s.message, null, "closing Razorpay shows no message; the swipe is simply ready again");
s = run(s, { type: "payment_failed", message: "Card declined" });
assert.equal(s.step, "paying");
assert.equal(s.message, "Card declined");
assert.equal(s.ticket, null);

// Paid but the server couldn't confirm yet: never claim failure, never claim success.
s = run(s, { type: "payment_succeeded", paymentId: "pay_1" }, { type: "verify_failed", message: "Network" });
assert.equal(s.step, "confirming");
assert.equal(s.paymentId, "pay_1");
assert.equal(s.ticket, null);
assert.equal(s.message, "We received your payment but couldn't confirm it yet. Retry, or message us with payment ID pay_1.");

// Only "confirmed" sets the ticket.
const done = run(s, { type: "confirmed", ticket });
assert.equal(done.step, "confirmed");
assert.equal(done.ticket, ticket);
assert.equal(done.message, null);

// Only a fresh payment gets the ticket-printer celebration.
assert.equal(done.celebrate, true, "confirmed after paying prints the ticket");
assert.equal(initialFlow({ state: "open" }, ticket).celebrate, false, "a returning guest just sees the ticket");

// Already registered: the existing ticket is shown straight from the details step.
assert.equal(run(filled, { type: "confirmed", ticket }).step, "confirmed");
assert.equal(run(filled, { type: "confirmed", ticket }).celebrate, false, "no celebration for a ticket bought earlier");

// Sold out mid-flow.
assert.equal(run(filled, { type: "sold_out" }).step, "sold_out");

// Errors and busy.
const errored = run(filled, { type: "busy", busy: true }, { type: "error", message: "That code didn't match." });
assert.equal(errored.busy, false, "an error ends the busy state");
assert.equal(errored.message, "That code didn't match.");
assert.equal(errored.step, "details");
assert.equal(run(errored, { type: "edit", field: "email", value: "x@y.co" }).message, null, "editing clears the message");

console.log("PASS registration flow");

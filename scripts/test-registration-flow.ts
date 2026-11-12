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
const filled = run(
  start,
  { type: "open" },
  { type: "edit", field: "name", value: "Asha" },
  { type: "edit", field: "email", value: "asha@example.com" },
  { type: "edit", field: "phone", value: "98765 43210" },
);
assert.equal(filled.step, "details");
assert.deepEqual(filled.details, { name: "Asha", email: "asha@example.com", phone: "98765 43210" });

// Changing the phone after the code went out asks for a new code.
const codeSent = run(filled, { type: "code_sent" });
assert.equal(codeSent.step, "code_sent");
assert.equal(run(codeSent, { type: "edit", field: "phone", value: "98765 43211" }).step, "details");
assert.equal(run(codeSent, { type: "edit", field: "name", value: "Asha R" }).step, "code_sent", "name edits keep the code");

// Payment: dismissing or failing keeps the details and stays ready to pay.
let s = run(codeSent, { type: "registration_created", registration });
const rephoned = run(s, { type: "edit", field: "phone", value: "98765 43211" });
assert.equal(rephoned.step, "details", "a new phone at the pay step needs a new code");
assert.equal(rephoned.registration, null, "and drops the order made for the old number");
assert.equal(s.step, "paying");
s = run(s, { type: "payment_dismissed" });
assert.equal(s.step, "paying");
assert.equal(s.details.name, "Asha");
assert.equal(s.registration, registration);
assert.equal(s.message, "Payment not completed. Your details are saved — try again when ready.");
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

// Already registered: the existing ticket is shown straight from the code step.
assert.equal(run(codeSent, { type: "confirmed", ticket }).step, "confirmed");

// Sold out mid-flow.
assert.equal(run(filled, { type: "sold_out" }).step, "sold_out");

// Errors and busy.
const errored = run(filled, { type: "busy", busy: true }, { type: "error", message: "That code didn't match." });
assert.equal(errored.busy, false, "an error ends the busy state");
assert.equal(errored.message, "That code didn't match.");
assert.equal(errored.step, "details");
assert.equal(run(errored, { type: "edit", field: "email", value: "x@y.co" }).message, null, "editing clears the message");

console.log("PASS registration flow");

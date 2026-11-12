import assert from "node:assert/strict";
import {
  RegistrationError,
  clearStoredTicketToken,
  formatIndianMobile,
  httpRegistrationApi,
  mockRegistrationApi,
  normalizeIndianMobile,
  readStoredTicketToken,
  storeTicketToken,
  validateDetails,
} from "../lib/client/eventRegistration";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(`session:${key}`) ?? null,
      setItem: (key: string, value: string) => void storage.set(`session:${key}`, value),
    },
  },
});

const calls: { url: string; init?: RequestInit }[] = [];
function stubFetch(status: number, body: unknown) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

async function main() {
  // Phone numbers: the formats people actually type all mean the same number.
  for (const raw of ["+91 98765 43210", "098765 43210", "98765-43210", "9876543210", "+919876543210"]) {
    assert.equal(normalizeIndianMobile(raw), "9876543210", raw);
  }
  for (const raw of ["987654321", "4412345678", "", "+1 415 555 0172", "98765432101"]) {
    assert.equal(normalizeIndianMobile(raw), null, raw);
  }

  // Display form for the "code sent to" hint: never doubles the +91.
  assert.equal(formatIndianMobile("+91 98765 43210"), "+91 98765 43210");
  assert.equal(formatIndianMobile("9876543210"), "+91 98765 43210");
  assert.equal(formatIndianMobile("12"), "12", "unparseable input is shown as typed");

  assert.deepEqual(validateDetails({ name: " ", email: "a@", phone: "123" }), {
    name: "Enter your name",
    email: "Enter a valid email",
    phone: "Enter a 10-digit mobile number",
  });
  assert.deepEqual(validateDetails({ name: "Asha", email: "asha@example.com", phone: "98765 43210" }), {});

  // Ticket token survives a reload, per event.
  storeTicketToken(7, "tok");
  assert.equal(readStoredTicketToken(7), "tok");
  assert.equal(readStoredTicketToken(8), null);
  clearStoredTicketToken(7);
  assert.equal(readStoredTicketToken(7), null);

  // HTTP client.
  const api = httpRegistrationApi(42);

  stubFetch(200, { registrationToken: "r1", orderId: "order_1", amount: 29900, currency: "INR", keyId: "rzp_test" });
  const created = await api.create({ name: "Asha", email: "asha@example.com", phone: "+91 98765 43210", code: "123456" });
  assert.equal(created.orderId, "order_1");
  const last = calls.at(-1)!;
  assert.equal(last.url, "/api/events/42/registrations");
  const sent = JSON.parse(String(last.init?.body));
  assert.equal("amount" in sent, false, "the client never sends an amount");
  assert.equal(sent.phone, "9876543210", "phone is sent normalized");

  stubFetch(409, { error: "You're already registered.", existingTicketToken: "t1" });
  await assert.rejects(api.create({ name: "Asha", email: "asha@example.com", phone: "9876543210", code: "123456" }), (error) => {
    assert.ok(error instanceof RegistrationError);
    assert.equal(error.status, 409);
    assert.equal(error.existingTicketToken, "t1");
    assert.equal(error.message, "You're already registered.");
    return true;
  });

  stubFetch(409, { error: "Sold out.", soldOut: true });
  await assert.rejects(api.create({ name: "A", email: "a@b.co", phone: "9876543210", code: "123456" }), (error) => {
    assert.ok(error instanceof RegistrationError && error.soldOut === true);
    return true;
  });

  stubFetch(404, { error: "Not found" });
  assert.equal(await api.getTicket("missing"), null);
  assert.equal(calls.at(-1)!.url, "/api/events/42/tickets/missing");

  stubFetch(429, { error: "Wait 30 seconds before asking for another code." });
  await assert.rejects(api.sendCode("9876543210"), /Wait 30 seconds/);
  assert.equal(calls.at(-1)!.url, "/api/events/42/registrations/otp");

  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  await assert.rejects(api.sendCode("9876543210"), (error) => {
    assert.ok(error instanceof RegistrationError);
    assert.equal(error.status, 0);
    assert.match(error.message, /connection/i);
    return true;
  });

  // Dev mock behaves like the contract.
  const mock = mockRegistrationApi();
  await assert.rejects(mock.create({ name: "A", email: "a@b.co", phone: "9876500000", code: "123456" }), (e) => e instanceof RegistrationError && e.soldOut === true);
  await assert.rejects(mock.create({ name: "A", email: "a@b.co", phone: "9876511111", code: "123456" }), (e) => e instanceof RegistrationError && e.existingTicketToken === "mock-existing");
  await assert.rejects(mock.create({ name: "A", email: "a@b.co", phone: "9876543210", code: "000000" }), /code/i);
  const reg = await mock.create({ name: "Asha", email: "a@b.co", phone: "9876543210", code: "123456" });
  const verified = await mock.verify({ registrationToken: reg.registrationToken, razorpay_order_id: reg.orderId, razorpay_payment_id: "pay_1", razorpay_signature: "sig" });
  assert.equal(verified.ticket.status, "confirmed");
  assert.deepEqual(await mock.getTicket(verified.ticketToken), verified.ticket);
  assert.equal((await mock.getTicket("mock-existing"))?.status, "confirmed");
  assert.equal(await mock.getTicket("nope"), null);
  // A fresh mock (a page reload in the dev preview) still knows the ticket.
  assert.deepEqual(await mockRegistrationApi().getTicket(verified.ticketToken), verified.ticket);

  console.log("PASS event registration client");
}

main().finally(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  else Reflect.deleteProperty(globalThis, "window");
});

import assert from "node:assert/strict";
import {
  EventHostError,
  classifyLoadError,
  filterGuests,
  guestsCsv,
  httpEventHostApi,
  mockEventHostApi,
  parseTicketQr,
  type HostGuest,
} from "../lib/client/eventHostApi";

const guest = (over: Partial<HostGuest>): HostGuest => ({
  code: "SCN-READ-0101",
  ticketToken: "tok-0101",
  name: "Asha Raman",
  phone: "+919876543210",
  email: "asha@example.com",
  status: "confirmed",
  registeredAt: "2026-11-15T10:00:00.000Z",
  checkedInAt: null,
  ...over,
});
const guests: HostGuest[] = [
  guest({}),
  guest({ code: "SCN-READ-0102", name: "Vijay K", phone: "+919800011122", email: "vijay@example.com", status: "checked_in", checkedInAt: "2026-11-22T05:20:00.000Z" }),
  guest({ code: "SCN-READ-0103", name: "Meera", phone: "+919811122233", email: "meera@example.com", status: "cancelled" }),
];

async function main() {
  // Search: name, code (any case), last digits of the phone.
  assert.deepEqual(filterGuests(guests, "asha", "all").map((g) => g.code), ["SCN-READ-0101"]);
  assert.deepEqual(filterGuests(guests, "scn-read-0102", "all").map((g) => g.name), ["Vijay K"]);
  assert.deepEqual(filterGuests(guests, "43210", "all").map((g) => g.name), ["Asha Raman"]);
  assert.equal(filterGuests(guests, "  ", "all").length, 3, "blank search shows everyone");
  assert.deepEqual(filterGuests(guests, "", "checked_in").map((g) => g.name), ["Vijay K"]);
  assert.deepEqual(filterGuests(guests, "", "not_arrived").map((g) => g.name), ["Asha Raman"], "not arrived = confirmed only");
  assert.deepEqual(filterGuests(guests, "", "cancelled").map((g) => g.name), ["Meera"]);

  // CSV: one row per guest, quotes and commas escaped.
  const csv = guestsCsv([guest({ name: 'Raman, "Asha"' })]).split("\n");
  assert.equal(csv[0], "Name,Phone,Email,Ticket,Status,Registered,Checked in");
  assert.equal(csv.length, 2);
  assert.ok(csv[1].startsWith('"Raman, ""Asha""",+919876543210,asha@example.com,SCN-READ-0101,confirmed,'));

  // QR: ticket links on SCENE (or this dev host), or a bare token.
  assert.equal(parseTicketQr("https://scene044.in/events/lets-do-more-reading-9044?ticket=abc123"), "abc123");
  assert.equal(parseTicketQr("http://localhost:3000/events/x-9044?ticket=abc123", "localhost"), "abc123");
  assert.equal(parseTicketQr("https://evil.example/events/x?ticket=abc123"), null, "other sites are refused");
  assert.equal(parseTicketQr("mock-existing"), "mock-existing");
  assert.equal(parseTicketQr("hello world"), null);

  // Load errors: signed out vs not approved vs anything else.
  assert.equal(classifyLoadError(401), "signin");
  assert.equal(classifyLoadError(403), "not_approved");
  assert.equal(classifyLoadError(500), "error");
  assert.equal(classifyLoadError(0), "error");

  // Mock: door check-in is idempotent; reminders record history.
  const mock = mockEventHostApi();
  const [event] = await mock.listEvents();
  assert.equal(event.capacity, 20);
  const before = (await mock.guests(event.id)).filter((g) => g.status === "checked_in").length;
  const first = await mock.checkIn(event.id, { code: "scn-read-0104" });
  assert.equal(first.alreadyCheckedIn, false);
  assert.equal(first.guest.status, "checked_in");
  const second = await mock.checkIn(event.id, { code: "SCN-READ-0104" });
  assert.equal(second.alreadyCheckedIn, true, "a second scan says already checked in");
  assert.equal((await mock.guests(event.id)).filter((g) => g.status === "checked_in").length, before + 1);
  await assert.rejects(mock.checkIn(event.id, { code: "SCN-NOPE" }), (e) => e instanceof EventHostError && e.status === 404);
  const reminders = await mock.reminders(event.id);
  assert.ok(reminders.templates.length >= 2);
  const sent = await mock.sendReminder(event.id, reminders.templates[0].id);
  assert.equal(sent.sent, reminders.templates[0].audience);
  assert.equal((await mock.reminders(event.id)).history[0].id, sent.id, "newest send first");
  const money = await mock.money(event.id);
  assert.equal(money.netPaise, money.grossPaise - money.feesPaise);

  // HTTP: paths and error statuses.
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  const stub = (status: number, body: unknown) => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
  };
  try {
    const api = httpEventHostApi();
    stub(200, { events: [] });
    await api.listEvents();
    assert.equal(calls.at(-1)!.url, "/api/host/events");
    stub(200, { guests: [] });
    await api.guests(7);
    assert.equal(calls.at(-1)!.url, "/api/host/events/7/guests");
    stub(200, { guest: guests[0], alreadyCheckedIn: false });
    await api.checkIn(7, { token: "tok" });
    assert.equal(calls.at(-1)!.url, "/api/host/events/7/checkin");
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { token: "tok" });
    stub(200, { id: "r1", templateName: "x", sentAt: "", sent: 1, delivered: 0, failed: 0 });
    await api.sendReminder(7, "day-before");
    assert.equal(calls.at(-1)!.url, "/api/host/events/7/reminders");
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { templateId: "day-before" });
    stub(200, { grossPaise: 0, feesPaise: 0, netPaise: 0, paymentsCount: 0, settlement: "", payments: [] });
    await api.money(7);
    assert.equal(calls.at(-1)!.url, "/api/host/events/7/payments");
    stub(403, { error: "This number isn't set up for an event yet." });
    await assert.rejects(api.listEvents(), (e) => e instanceof EventHostError && e.status === 403);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("PASS event host client and helpers");
}
void main();

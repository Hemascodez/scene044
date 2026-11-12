import assert from "node:assert/strict";
import { eventTicketHref, fetchMyEventTickets, splitEventTickets, type MyEventTicket } from "../lib/client/myEventTickets";

const base: MyEventTicket = {
  eventId: 9044,
  slug: "lets-do-more-reading-9044",
  title: "Let's do more reading",
  posterImageUrl: "/events/chapter-lounge/poster.jpg",
  startAt: "2026-11-22T05:30:00.000Z",
  endAt: "2026-11-22T07:30:00.000Z",
  venueName: "Madras Adda",
  ticket: { code: "SCN-READ-0101", name: "Asha", phoneMasked: "+91 ••••• 43210", status: "confirmed", qrValue: "t" },
  ticketToken: "tok/en 1",
};
const before = new Date("2026-11-20T00:00:00Z");
const after = new Date("2026-11-22T08:00:00Z");

assert.deepEqual(splitEventTickets([base], before), { upcoming: [base], past: [] });
assert.deepEqual(splitEventTickets([base], after), { upcoming: [], past: [base] }, "ended events move to past");
const cancelled = { ...base, ticket: { ...base.ticket, status: "cancelled" as const } };
assert.deepEqual(splitEventTickets([cancelled], before).past, [cancelled], "cancelled tickets are not upcoming");
const noEnd = { ...base, endAt: null };
assert.equal(splitEventTickets([noEnd], new Date("2026-11-22T06:30:00Z")).upcoming.length, 1, "no end time: assume two hours");
assert.equal(splitEventTickets([noEnd], new Date("2026-11-22T08:00:00Z")).past.length, 1);

const later = { ...base, eventId: 2, startAt: "2026-12-06T05:30:00.000Z", endAt: "2026-12-06T07:30:00.000Z" };
assert.deepEqual(splitEventTickets([later, base], before).upcoming.map((t) => t.eventId), [9044, 2], "upcoming soonest first");
assert.deepEqual(splitEventTickets([base, later], new Date("2027-01-01T00:00:00Z")).past.map((t) => t.eventId), [2, 9044], "past most recent first");

assert.equal(eventTicketHref(base), "/events/lets-do-more-reading-9044?ticket=tok%2Fen%201");

async function main() {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404 })) as typeof fetch;
    assert.deepEqual(await fetchMyEventTickets(), [], "My bookings works before the backend has the endpoint");
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, "/api/me/event-registrations");
      return new Response(JSON.stringify({ registrations: [base] }), { status: 200 });
    }) as typeof fetch;
    assert.deepEqual(await fetchMyEventTickets(), [base]);
    globalThis.fetch = (async () => new Response("{}", { status: 500 })) as typeof fetch;
    await assert.rejects(fetchMyEventTickets(), /event tickets/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("PASS my event tickets");
}
void main();

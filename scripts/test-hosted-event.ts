import assert from "node:assert/strict";
import { CHAPTER_LOUNGE_FIXTURE, formatRupees, seatSummary } from "../lib/hostedEvents";
import { hostedGlanceFacts } from "../lib/client/sceneEvent";

const END = "2026-11-22T07:30:00.000Z"; // 1:00 pm IST
const BEFORE = new Date("2026-11-20T06:00:00.000Z");
const AFTER_END = new Date("2026-11-22T08:00:00.000Z");
const hosted = { ...CHAPTER_LOUNGE_FIXTURE.hosted };

assert.equal(formatRupees(29900), "₹299");
assert.equal(formatRupees(150000), "₹1,500");

assert.deepEqual(seatSummary(hosted, END, BEFORE), { state: "open", spotsLeft: 6, label: "6 of 20 spots left" });
assert.equal(seatSummary({ ...hosted, registeredCount: 19 }, END, BEFORE).label, "1 spot left");
assert.deepEqual(seatSummary({ ...hosted, registeredCount: 20 }, END, BEFORE), { state: "sold_out", spotsLeft: 0, label: "Sold out" });
assert.equal(seatSummary({ ...hosted, registeredCount: 25 }, END, BEFORE).spotsLeft, 0, "overbooked never shows negative seats");
assert.equal(seatSummary({ ...hosted, registrationState: "sold_out", registeredCount: 3 }, END, BEFORE).state, "sold_out", "server state wins");
assert.deepEqual(seatSummary({ ...hosted, registrationState: "closed" }, END, BEFORE), { state: "closed", spotsLeft: 6, label: "Registration closed" });
assert.deepEqual(seatSummary(hosted, END, AFTER_END), { state: "ended", spotsLeft: 0, label: "This event has ended" });
assert.equal(seatSummary({ ...hosted, registrationState: "closed" }, END, AFTER_END).state, "ended", "ended wins over closed");

assert.equal(CHAPTER_LOUNGE_FIXTURE.hosted.pricePaise, 29900);
assert.equal(CHAPTER_LOUNGE_FIXTURE.hosted.capacity, 20);
assert.equal(CHAPTER_LOUNGE_FIXTURE.hosted.gallery.length, 7);
assert.ok(CHAPTER_LOUNGE_FIXTURE.hosted.gallery.every((photo) => photo.alt.trim().length > 0), "every gallery photo has alt text");

// Good to know: numbered groups of icon cards, as on the venue page.
const knownIcons = new Set(["book", "coffee", "clock", "qr", "users", "seating", "sparkle", "pin"]);
const groups = CHAPTER_LOUNGE_FIXTURE.hosted.goodToKnow;
assert.deepEqual(groups.map((g) => g.group), ["What to bring", "What's included", "Getting in"]);
assert.ok(groups.every((g) => g.note.length > 0 && g.items.length > 0));
assert.ok(groups.flatMap((g) => g.items).every((item) => knownIcons.has(item.icon)), "every card uses a known icon");
assert.ok(groups[2].items.some((item) => /30 minutes/.test(item.text)), "arrival advice matches the terms");

// Terms: the owner's ten, verbatim order; refunds follow term 1.
const { terms, refundPolicy } = CHAPTER_LOUNGE_FIXTURE.hosted;
assert.equal(terms.length, 10);
assert.equal(terms[0], "Tickets once booked cannot be exchanged or refunded.");
assert.match(terms[9], /^These Terms & Conditions are subject to change/);
assert.equal(refundPolicy, "Tickets once booked cannot be exchanged or refunded.");

const facts = hostedGlanceFacts(CHAPTER_LOUNGE_FIXTURE);
assert.deepEqual(facts.map((fact) => fact.label), ["When", "Where", "Host", "Price", "Bring"]);
assert.equal(facts[0].value, "Sun, 22 Nov · 11:00 am – 1:00 pm");
assert.equal(facts[1].value, "Madras Adda");
assert.equal(facts[1].hint, "Mylapore, Chennai");
assert.equal(facts[2].value, "Sadhana · Chapter Lounge");
assert.equal(facts[3].value, "₹299 · refreshments included");
assert.equal(facts[4].value, "Any book, poetry or your Kindle");
assert.equal(CHAPTER_LOUNGE_FIXTURE.hosted.hostPerson, "Sadhana");

console.log("PASS hosted event seat summary and glance facts");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { attendeePhone, httpAttendeeAuth, mockAttendeeAuth, pastedOtp } from "../lib/client/attendeeAuth";
import { eventTicketLocation, validEventTicketToken } from "../lib/eventTicketLocation";
import { gaInlineScript } from "../lib/client/analytics";
import { ticketQrDataUrl } from "../lib/client/ticketQr";
import sharp from "sharp";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";

async function main() {
  for (const value of ["9876543210", "09876543210", "+91 98765 43210", "0091 98765 43210", "+91 09876543210"]) assert.equal(attendeePhone(value), "9876543210", value);
  for (const value of ["1234567890", "98765", "+44 9876543210"]) assert.equal(attendeePhone(value), null);
  assert.equal(pastedOtp("Your SCENE code is 012345. Do not share it."), "012345");
  assert.equal(pastedOtp("123456"), "123456");
  assert.equal(pastedOtp("01 23 45"), "012345");
  const token = "a".repeat(64);
  assert.ok(validEventTicketToken(token));
  assert.equal(validEventTicketToken([token]), false);
  assert.equal(validEventTicketToken("mock-ticket"), false);
  assert.equal(eventTicketLocation({ id: 164, title: "Let's do more reading" }, token), `/events/let-s-do-more-reading-164/ticket?ticket=${token}`);
  const qrValue = `https://scene044.in${eventTicketLocation({ id: 164, title: "Let's do more reading" }, token)}`;
  const png = Buffer.from((await ticketQrDataUrl(qrValue)).split(",")[1], "base64");
  for (const size of [364, 182]) {
    const { data, info } = await sharp(png).resize(size, size).greyscale().raw().toBuffer({ resolveWithObject: true });
    const image = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height)));
    assert.equal(new QRCodeReader().decode(image).getText(), qrValue, `real QR decodes at ${size}px without a camera or provider calls`);
  }
  for (const [pathname, search, tracked] of [["/events/example-1", "", 2], ["/events/example-1", `?ticket=${token}`, 0], ["/events/example-1/ticket", "", 0], ["/events/example-1/ticket/", "?new=1", 0]] as const) {
    const context = { window: { location: { pathname, search } }, URLSearchParams, dataLayer: [] as unknown[] };
    runInNewContext(gaInlineScript("G-TEST"), context);
    assert.equal(context.dataLayer.length, tracked, `private ticket route must not initialize analytics: ${pathname}`);
  }
  const original = globalThis.fetch;
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ path: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ ok: true, profile: { name: "Preview Reader", email: "reader@example.com", phone: "9876543210", role: "Organiser" } }));
  }) as typeof fetch;
  try {
    await httpAttendeeAuth.send("09876543210");
    assert.deepEqual(calls[0], { path: "/api/whatsapp/send-otp", body: { phone: "9876543210" } });
    const details = { name: "Preview Reader", email: "reader@example.com", phone: "+91 9876543210" };
    await httpAttendeeAuth.verify(details, "012345");
    assert.equal(calls[1].body.code, "012345");
    assert.equal(calls[1].body.role, "Organiser", "legacy guest account role; never request Host access");
    assert.ok(!("venue" in calls[1].body) && !("eventId" in calls[1].body));
    await assert.rejects(mockAttendeeAuth.verify(details, "000000"));
  } finally { globalThis.fetch = original; }
  const source = (path: string) => readFileSync(path, "utf8");
  const form = source("components/scene/hosted/AttendeeForm.tsx");
  assert.doesNotMatch(form, /SELECT CATEGORY|>Host<|>Organiser</);
  assert.match(form, /autoComplete="one-time-code"/);
  assert.match(form, /onPaste=/);
  assert.match(form, /useState\(false\)/, "optional WhatsApp consent starts off");
  const swipe = source("components/scene/hosted/ReaderPass.tsx");
  assert.match(swipe, /nx >= maxX \* SWIPE_COMPLETE_AT/);
  assert.match(swipe, /onClick=/, "swiping has a native-click fallback");
  assert.match(swipe, /e\.repeat/);
  const dialog = source("components/scene/hosted/EventFlowDialog.tsx");
  assert.match(dialog, /visualViewport/);
  assert.match(dialog, /overflow-y-auto/);
  assert.match(dialog, /aria-modal="true"/);
  const host = source("components/venues/figma/EventHostWorkspace.tsx");
  const guestAction = host.split("onCheckIn={async")[1]?.split("/>\n")[0] ?? "";
  assert.match(guestAction, /setTab\('checkin'\)/);
  assert.doesNotMatch(guestAction, /await checkIn|api\.checkIn/, "opening check-in must not mark arrival");
  assert.match(host, /Confirm arrival/);
  assert.match(source("app/dev/hosted-ticket/page.tsx"), /NODE_ENV === "production"\) notFound/);
  const ticketPage = source("components/scene/hosted/HostedTicketPage.tsx");
  assert.match(ticketPage, /visit\.current \?\?=/, "capture new-payment flag before history scrubbing / Strict Mode remount");
  assert.match(ticketPage, /<TicketPrinter phase=\{phase\}/);
  assert.match(ticketPage, /PRINT_TIMING\.feedMs \+ PRINT_TIMING\.settleMs/);
  assert.match(ticketPage, /celebrate \? <FreshTicket/, "only newly verified payment visits print, existing tickets open directly");
  assert.doesNotMatch(ticketPage, /storeTicketToken\(/, "opening a shared pass must not claim it as the viewer's registration");
  assert.doesNotMatch(ticketPage, /href="\/my-bookings"/, "My bookings must use the real /bookings route");
  assert.match(source("components/scene/hosted/TicketView.tsx"), /href="\/bookings"/);
  const registration = source("components/scene/hosted/HostedRegistration.tsx");
  assert.match(registration, /window\.location\.assign/);
  assert.doesNotMatch(registration, /<TicketView|<TicketPrinter/, "tickets belong on the separate page");
  assert.match(registration, /await fetchMyEventTickets\(\)/, "registered state is scoped to the current authenticated account");
  assert.match(source("components/scene/hosted/TicketView.tsx"), /window\.location\.origin}\$\{eventPath\(event\)\}/, "invites share the public event, not the private pass");
  assert.match(source("components/scene/hosted/TicketView.tsx"), /ticketQrDataUrl\(ticket.qrValue\)/, "use the actual ticket credential, never the supplied mock QR pattern");
  console.log("PASS attendee normalization, OTP paste, auth contract, private ticket routing/analytics, printer preservation, real QR decoding at 182px/364px, keyboard dialog and scan-first host action; no real messages or payments");
}
void main();

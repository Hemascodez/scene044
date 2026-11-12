/** Real PostgreSQL SQL in an isolated in-memory database; every provider call is stubbed. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { hashVenueSession, VENUE_SESSION_COOKIE } from "../lib/venueUserAuth";
import type {
  CreatedRegistration,
  Ticket,
} from "../lib/client/eventRegistration";

async function main() {
  const db = new PGlite();
  const oldPool = globalThis.__pgPool;
  const oldFetch = globalThis.fetch;
  const envKeys = [
    "CURATOR_PASSWORD",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_GRAPH_API_VERSION",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_OTP_TEMPLATE_NAME",
    "WHATSAPP_OTP_TEMPLATE_LANGUAGE",
    "WHATSAPP_HOSTED_EVENTS_ENABLED",
    "WHATSAPP_EVENT_TICKET_TEMPLATE_NAME",
    "WHATSAPP_EVENT_DAY_BEFORE_TEMPLATE_NAME",
  ];
  const saved = envKeys.map((key) => [key, process.env[key]] as const);
  let tail = Promise.resolve();
  async function acquire() {
    let release!: () => void;
    const next = new Promise<void>((r) => {
      release = r;
    });
    const prev = tail;
    tail = next;
    await prev;
    return release;
  }
  const execute = async (sql: string, params?: unknown[]) => {
    try {
      const result = await db.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.affectedRows ?? result.rows.length,
      };
    } catch (error) {
      console.error(
        "Isolated SQL failed:",
        sql,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  };
  globalThis.__pgPool = {
    query: async (sql: string, params?: unknown[]) => {
      const release = await acquire();
      try {
        return await execute(sql, params);
      } finally {
        release();
      }
    },
    connect: async () => {
      const release = await acquire();
      return { query: execute, release };
    },
  } as unknown as NonNullable<typeof globalThis.__pgPool>;
  process.env.CURATOR_PASSWORD = "isolated-curator";
  process.env.RAZORPAY_KEY_ID = "rzp_test_isolated";
  process.env.RAZORPAY_KEY_SECRET = "isolated-payment-secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "isolated-webhook-secret";
  process.env.WHATSAPP_ACCESS_TOKEN = "isolated-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v99.0";
  process.env.WHATSAPP_APP_SECRET = "isolated-otp-secret";
  process.env.WHATSAPP_OTP_TEMPLATE_NAME = "isolated-otp";
  process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE = "en";
  delete process.env.WHATSAPP_HOSTED_EVENTS_ENABLED;
  type Payment = {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
    fee: number;
  };
  const orders = new Map<
    string,
    {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
      status: string;
    }
  >();
  const payments = new Map<string, Payment>();
  let otp = "";
  let providerCalls = 0;
  let metaCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    providerCalls++;
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (
      url === "https://api.razorpay.com/v1/orders" &&
      init?.method === "POST"
    ) {
      const body = JSON.parse(String(init.body)) as {
        amount: number;
        currency: string;
        receipt: string;
      };
      const id = `order_${orders.size + 1}`;
      const order = { id, ...body, status: "created" };
      orders.set(id, order);
      return json(order);
    }
    const byOrder =
      /https:\/\/api\.razorpay\.com\/v1\/orders\/(order_\w+)\/payments$/.exec(
        url,
      );
    if (byOrder)
      return json({
        items: [...payments.values()].filter((p) => p.order_id === byOrder[1]),
      });
    const byPayment =
      /https:\/\/api\.razorpay\.com\/v1\/payments\/(pay_\w+)(\/capture)?$/.exec(
        url,
      );
    if (byPayment) {
      const p = payments.get(byPayment[1]);
      if (!p) return json({}, 404);
      if (byPayment[2]) p.status = "captured";
      return json(p);
    }
    if (url === "https://graph.facebook.com/v99.0/1234/messages") {
      metaCalls++;
      const body = JSON.parse(String(init?.body));
      otp = body.template.components.find(
        (c: { type: string }) => c.type === "body",
      ).parameters[0].text;
      return json({ messages: [{ id: `wamid.isolated${metaCalls}` }] });
    }
    throw new Error(`Unexpected provider request blocked by test: ${url}`);
  }) as typeof fetch;
  const req = (
    path: string,
    method = "GET",
    body?: unknown,
    session?: string,
    admin = false,
    origin?: string,
  ) =>
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(session ? { cookie: `${VENUE_SESSION_COOKIE}=${session}` } : {}),
        ...(admin
          ? {
              authorization: `Basic ${Buffer.from("curator:isolated-curator").toString("base64")}`,
            }
          : {}),
        ...(origin ? { origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const ctx = (id: number, token?: string) => ({
    params: Promise.resolve({ id: String(id), ...(token ? { token } : {}) }),
  });
  const data = async <T>(response: Response) => (await response.json()) as T;
  try {
    await db.exec(readFileSync("db/schema.sql", "utf8"));
    await db.exec(
      readFileSync(
        "db/migrations/2026-10-08-multi-venue-host-access.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync("db/migrations/2026-11-12-hosted-events.sql", "utf8"),
    );
    await db.exec(
      readFileSync("db/migrations/2026-11-12-hosted-events.sql", "utf8"),
    ); // repeatable migration
    const { prepareChapterLoungeDraft, saveHostedEventSettings, hostedEventAdminCatalog } =
      await import("../lib/hostedEventAdmin");
    const draft = await prepareChapterLoungeDraft();
    assert.equal(
      (await prepareChapterLoungeDraft()).eventId,
      draft.eventId,
      "draft preparation is idempotent",
    );
    const chapter = await db.query<{ status: string; category: string }>(
      "SELECT status,category FROM events WHERE id=$1",
      [draft.eventId],
    );
    assert.deepEqual(chapter.rows[0], {
      status: "pending_review",
      category: "arts",
    });
    assert.equal(
      (await db.query("SELECT id FROM event_registrations")).rows.length,
      0,
    );
    const { getHostedEventInfo } = await import("../lib/hostedEventData");
    assert.equal(
      (await getHostedEventInfo(draft.eventId))?.registeredCount,
      0,
      "no preview guest is copied into the database",
    );
    assert.equal(
      (await getHostedEventInfo(draft.eventId))?.gallery.length,
      7,
      "real supplied photos are retained",
    );
    console.log(
      "PASS migration, repeatable unpublished Arts draft, real content and zero initial registrations",
    );
    const settings = (await hostedEventAdminCatalog()).find(e => e.id === draft.eventId)!;
    const gist = "Two uninterrupted hours, just you and your book with a cup of tea and good company.";
    await saveHostedEventSettings({ ...settings, eventId: draft.eventId, capacity: 15, gist });
    assert.equal((await getHostedEventInfo(draft.eventId))?.capacity, 15);
    assert.equal((await db.query<{gist:string}>("SELECT gist FROM events WHERE id=$1", [draft.eventId])).rows[0].gist, gist);
    await saveHostedEventSettings({ ...settings, eventId: draft.eventId, capacity: 15, gist: "A separate isolated copy update." });
    const withoutGist = { ...settings };
    delete withoutGist.gist;
    await saveHostedEventSettings({ ...withoutGist, eventId: draft.eventId, capacity: 15 });
    assert.equal((await db.query<{gist:string}>("SELECT gist FROM events WHERE id=$1", [draft.eventId])).rows[0].gist, "A separate isolated copy update.", "legacy settings saves preserve the gist when omitted");
    await assert.rejects(() => saveHostedEventSettings({ ...settings, eventId: draft.eventId, gist: "x".repeat(141) }), /140 characters/);
    console.log("PASS 15-seat correction and editable At a glance copy; omitted gist preserved and invalid copy rejected");
    const quote = { ...settings.quote, text: "It's warm to see people immerse themselves in books. Stories, conversations and some chai. Thank you Sadhana and Chapter Lounge for this beautiful Sunday morning." };
    await db.query("UPDATE hosted_events SET quote=$2::jsonb WHERE event_id=$1", [draft.eventId, JSON.stringify({ text: "Previous stored review.", by: settings.quote.by })]);
    await saveHostedEventSettings({ ...settings, eventId: draft.eventId, quote });
    assert.deepEqual((await getHostedEventInfo(draft.eventId))?.quote, quote, "review text is persisted, not preview-only");
    const withoutQuote = { ...settings };
    delete withoutQuote.quote;
    await saveHostedEventSettings({ ...withoutQuote, eventId: draft.eventId });
    assert.deepEqual((await getHostedEventInfo(draft.eventId))?.quote, quote, "unrelated settings saves preserve the live review");
    for (const invalid of [{text:"",by:"Reader"},{text:"Review",by:""},{text:"Review",by:"Reader",highlight:"not present"}]) {
      await assert.rejects(() => saveHostedEventSettings({ ...settings, eventId: draft.eventId, quote: invalid }), /Enter a review/);
    }
    console.log("PASS live review updates, retained attribution, omitted-review preservation and invalid review rejection");

    const userIds: number[] = [];
    const sessions: string[] = [];
    for (let i = 0; i < 4; i++) {
      const phone = `91987654321${i}`;
      const user = (
        await db.query<{ id: number }>(
          "INSERT INTO venue_users(phone_e164,name,email,role) VALUES($1,$2,$3,'Organiser') RETURNING id",
          [phone, `Guest ${i}`, `guest${i}@example.com`],
        )
      ).rows[0];
      userIds.push(user.id);
      const token = crypto.randomBytes(32).toString("hex");
      sessions.push(token);
      await db.query(
        "INSERT INTO venue_user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",
        [user.id, hashVenueSession(token)],
      );
    }
    const eventId = draft.eventId;
    await db.query(
      "UPDATE events SET status='live',start_at=now()+interval '10 days',end_at=now()+interval '10 days 2 hours' WHERE id=$1",
      [eventId],
    );
    await db.query(
      "UPDATE hosted_events SET registration_state='open',capacity=1 WHERE event_id=$1",
      [eventId],
    );
    const { POST: create } =
      await import("../app/api/events/[id]/registrations/route");
    const { POST: verify } =
      await import("../app/api/events/[id]/registrations/verify/route");
    const { GET: seats } = await import("../app/api/events/[id]/seats/route");
    const { GET: ticket } =
      await import("../app/api/events/[id]/tickets/[token]/route");
    const { GET: mine } =
      await import("../app/api/me/event-registrations/route");
    const { POST: webhook } = await import("../app/api/razorpay/webhook/route");
    const details = {
      name: "Guest Zero",
      email: "guest0@example.com",
      whatsappOptIn: true,
    };
    assert.equal(
      (
        await create(
          req("/api/events/x/registrations", "POST", details),
          ctx(eventId),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await create(
          req(
            "/api/events/x/registrations",
            "POST",
            details,
            sessions[0],
            false,
            "https://evil.example",
          ),
          ctx(eventId),
        )
      ).status,
      403,
    );
    const concurrent = await Promise.all([
      create(
        req("/api/events/x/registrations", "POST", details, sessions[0]),
        ctx(eventId),
      ),
      create(
        req(
          "/api/events/x/registrations",
          "POST",
          { ...details, name: "Guest One" },
          sessions[1],
        ),
        ctx(eventId),
      ),
    ]);
    assert.deepEqual(
      concurrent.map((r) => r.status).sort(),
      [200, 409],
      "only one attendee may hold the last seat",
    );
    const winner = concurrent[0].status === 200 ? 0 : 1;
    const loser = 1 - winner;
    const order = await data<CreatedRegistration>(concurrent[winner]);
    assert.equal(order.amount, 29900);
    assert.equal(orders.size, 1);
    const retried = await create(
      req("/api/events/x/registrations", "POST", details, sessions[winner]),
      ctx(eventId),
    );
    assert.equal(
      (await data<CreatedRegistration>(retried)).orderId,
      order.orderId,
    );
    assert.equal(orders.size, 1, "retry reuses the order");
    assert.deepEqual(
      await data(await seats(req("/api/events/x/seats"), ctx(eventId))),
      { registeredCount: 0, capacity: 1 },
      "held seats are not paid registrations",
    );
    const payment: Payment = {
      id: "pay_one",
      order_id: order.orderId,
      amount: 29900,
      currency: "INR",
      status: "captured",
      fee: 700,
    };
    payments.set(payment.id, payment);
    const signature = crypto
      .createHmac("sha256", "isolated-payment-secret")
      .update(`${order.orderId}|${payment.id}`)
      .digest("hex");
    const verification = {
      registrationToken: order.registrationToken,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: signature,
    };
    assert.equal(
      (
        await verify(
          req(
            "/api/events/x/registrations/verify",
            "POST",
            verification,
            sessions[loser],
          ),
          ctx(eventId),
        )
      ).status,
      404,
      "another account cannot confirm this registration",
    );
    assert.equal(
      (
        await verify(
          req(
            "/api/events/x/registrations/verify",
            "POST",
            { ...verification, razorpay_signature: "invalid" },
            sessions[winner],
          ),
          ctx(eventId),
        )
      ).status,
      400,
    );
    const verified = await verify(
      req(
        "/api/events/x/registrations/verify",
        "POST",
        verification,
        sessions[winner],
      ),
      ctx(eventId),
    );
    assert.equal(verified.status, 200, await verified.clone().text());
    const paid = await data<{ ticket: Ticket; ticketToken: string }>(verified);
    assert.equal(paid.ticket.status, "confirmed");
    assert.match(paid.ticket.code, /^SCN-EVT-/);
    assert.ok(!JSON.stringify(paid.ticket).includes("@example.com"));
    assert.equal(
      (
        await ticket(req("/api/events/x/tickets/x"), {
          params: Promise.resolve({
            id: String(eventId),
            token: paid.ticketToken,
          }),
        })
      ).status,
      200,
    );
    assert.deepEqual(
      await data(await seats(req("/api/events/x/seats"), ctx(eventId))),
      { registeredCount: 1, capacity: 1 },
    );
    const signedWebhook = () => {
      const raw = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: payment } },
      });
      return new Request("http://localhost/api/razorpay/webhook", {
        method: "POST",
        headers: {
          "x-razorpay-signature": crypto
            .createHmac("sha256", "isolated-webhook-secret")
            .update(raw)
            .digest("hex"),
        },
        body: raw,
      });
    };
    assert.equal(
      (await webhook(req("/api/razorpay/webhook", "POST", { bad: true })))
        .status,
      401,
    );
    assert.equal((await webhook(signedWebhook())).status, 200);
    assert.equal((await webhook(signedWebhook())).status, 200);
    assert.equal(
      (await db.query("SELECT id FROM event_notifications")).rows.length,
      1,
      "browser callback and duplicate webhooks queue exactly one confirmation",
    );
    assert.equal(
      (
        await data<{ registrations: unknown[] }>(
          await mine(
            req(
              "/api/me/event-registrations",
              "GET",
              undefined,
              sessions[winner],
            ),
          ),
        )
      ).registrations.length,
      1,
    );
    assert.equal(
      (
        await data<{ registrations: unknown[] }>(
          await mine(
            req(
              "/api/me/event-registrations",
              "GET",
              undefined,
              sessions[loser],
            ),
          ),
        )
      ).registrations.length,
      0,
    );
    console.log(
      "PASS server price, last-seat hold, order reuse, signature/owner checks, captured payment, ticket privacy and idempotent webhook",
    );

    const { POST: approve, GET: hostAccess } =
      await import("../app/api/admin/event-hosts/route");
    const { GET: listHost } = await import("../app/api/host/events/route");
    const { GET: guestList } =
      await import("../app/api/host/events/[id]/guests/route");
    const { POST: checkin } =
      await import("../app/api/host/events/[id]/checkin/route");
    const { POST: sendOtp } =
      await import("../app/api/whatsapp/send-otp/route");
    const { POST: verifyOtp } =
      await import("../app/api/whatsapp/verify-otp/route");
    const hostPhone = "9876543213";
    assert.equal((await hostAccess(req("/api/admin/event-hosts"))).status, 401);
    assert.equal(
      (
        await approve(
          req(
            "/api/admin/event-hosts",
            "POST",
            { eventId, phone: hostPhone, label: "Approved event host" },
            undefined,
            true,
          ),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await sendOtp(
          req("/api/whatsapp/send-otp", "POST", {
            phone: "9876543212",
            role: "Host",
            eventId,
          }),
        )
      ).status,
      403,
    );
    assert.equal(metaCalls, 0);
    assert.equal(
      (
        await sendOtp(
          req("/api/whatsapp/send-otp", "POST", {
            phone: hostPhone,
            role: "Host",
            eventId,
          }),
        )
      ).status,
      200,
    );
    const login = await verifyOtp(
      req("/api/whatsapp/verify-otp", "POST", {
        phone: hostPhone,
        code: otp,
        role: "Host",
        eventId,
        name: "Approved event host",
      }),
    );
    assert.equal(login.status, 200, await login.clone().text());
    const loginProfile = await data<{
      profile: { hostEventId: number; venue?: string };
    }>(login);
    assert.equal(loginProfile.profile.hostEventId, eventId);
    assert.equal(loginProfile.profile.venue, undefined);
    const hostSession = /scene044_venue_session=([a-f0-9]+)/.exec(
      login.headers.get("set-cookie")!,
    )![1];
    assert.equal(
      (await listHost(req("/api/host/events", "GET", undefined, hostSession)))
        .status,
      200,
    );
    assert.equal(
      (
        await guestList(
          req("/api/host/events/x/guests", "GET", undefined, sessions[loser]),
          ctx(eventId),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await guestList(
          req("/api/host/events/x/guests", "GET", undefined, hostSession),
          ctx(eventId + 1),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await data<{ guests: unknown[] }>(
          await guestList(
            req("/api/host/events/x/guests", "GET", undefined, hostSession),
            ctx(eventId),
          ),
        )
      ).guests.length,
      1,
    );
    const checked = await data<{ alreadyCheckedIn: boolean }>(
      await checkin(
        req(
          "/api/host/events/x/checkin",
          "POST",
          { token: paid.ticketToken },
          hostSession,
        ),
        ctx(eventId),
      ),
    );
    assert.equal(checked.alreadyCheckedIn, false);
    assert.equal(
      (
        await data<{ alreadyCheckedIn: boolean }>(
          await checkin(
            req(
              "/api/host/events/x/checkin",
              "POST",
              { code: paid.ticket.code },
              hostSession,
            ),
            ctx(eventId),
          ),
        )
      ).alreadyCheckedIn,
      true,
    );
    const { checkHostAccess } = await import("../lib/venueHostAccess");
    assert.equal(
      await checkHostAccess(
        req("/api/host/bookings", "GET", undefined, hostSession),
      ),
      false,
      "event login never grants venue access",
    );
    const { proxy } = await import("../proxy");
    assert.equal(
      (
        await proxy(
          new NextRequest("http://localhost/host/events", {
            headers: { cookie: `${VENUE_SESSION_COOKIE}=${hostSession}` },
          }),
        )
      ).headers.get("x-middleware-next"),
      "1",
    );
    const { GET: money } =
      await import("../app/api/host/events/[id]/payments/route");
    const totals = await data<{
      grossPaise: number;
      feesPaise: number;
      netPaise: number;
      paymentsCount: number;
    }>(
      await money(
        req("/api/host/events/x/payments", "GET", undefined, hostSession),
        ctx(eventId),
      ),
    );
    assert.equal(totals.grossPaise, 29900);
    assert.equal(totals.feesPaise, 700);
    assert.equal(totals.netPaise, 29200);
    assert.equal(totals.paymentsCount, 1);
    console.log(
      "PASS manual curator approval, real OTP/session logic (stub sender), event/venue isolation, per-event privacy, check-in and real-payment totals",
    );

    const waitlist = await import("../app/api/events/[id]/waitlist/route");
    assert.equal(
      (
        await waitlist.POST(
          req("/api/events/x/waitlist", "POST", undefined, sessions[loser]),
          ctx(eventId),
        )
      ).status,
      200,
    );
    assert.deepEqual(
      await data(
        await waitlist.GET(
          req("/api/events/x/waitlist", "GET", undefined, sessions[loser]),
          ctx(eventId),
        ),
      ),
      { waitlisted: true },
    );
    assert.equal(
      (
        await waitlist.DELETE(
          req("/api/events/x/waitlist", "DELETE", undefined, sessions[loser]),
          ctx(eventId),
        )
      ).status,
      200,
    );
    assert.deepEqual(
      await data(
        await waitlist.GET(
          req("/api/events/x/waitlist", "GET", undefined, sessions[loser]),
          ctx(eventId),
        ),
      ),
      { waitlisted: false },
    );
    const { POST: reminder } =
      await import("../app/api/host/events/[id]/reminders/route");
    assert.equal(
      (
        await reminder(
          req(
            "/api/host/events/x/reminders",
            "POST",
            { templateId: "day-before" },
            hostSession,
          ),
          ctx(eventId),
        )
      ).status,
      409,
      "unapproved templates cannot send",
    );
    process.env.WHATSAPP_HOSTED_EVENTS_ENABLED = "true";
    process.env.WHATSAPP_EVENT_TICKET_TEMPLATE_NAME = "isolated-ticket";
    process.env.WHATSAPP_EVENT_DAY_BEFORE_TEMPLATE_NAME = "isolated-reminder";
    const notifications = await import("../lib/eventNotifications");
    await notifications.drainEventNotifications();
    const job = (
      await db.query<{
        id: number;
        state: string;
        provider_message_id: string;
      }>("SELECT id,state,provider_message_id FROM event_notifications")
    ).rows[0];
    assert.equal(job.state, "accepted");
    await notifications.recordEventNotificationReceipt(
      job.provider_message_id,
      "read",
      `event-notification:${job.id}`,
    );
    await notifications.recordEventNotificationReceipt(
      job.provider_message_id,
      "sent",
      `event-notification:${job.id}`,
    );
    assert.equal(
      (
        await db.query<{ state: string }>(
          "SELECT state FROM event_notifications WHERE id=$1",
          [job.id],
        )
      ).rows[0].state,
      "read",
      "late callback cannot regress read",
    );
    assert.equal(
      (
        await reminder(
          req(
            "/api/host/events/x/reminders",
            "POST",
            { templateId: "day-before" },
            hostSession,
          ),
          ctx(eventId),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await reminder(
          req(
            "/api/host/events/x/reminders",
            "POST",
            { templateId: "day-before" },
            hostSession,
          ),
          ctx(eventId),
        )
      ).status,
      409,
      "repeat reminder is not broadcast twice",
    );
    console.log(
      "PASS persisted waitlist, template gates, opted-in outbox, accurate delivery status and duplicate-reminder prevention",
    );

    const access = (
      await db.query<{ id: number }>(
        "SELECT id FROM event_host_access WHERE event_id=$1",
        [eventId],
      )
    ).rows[0];
    const { DELETE: revoke } =
      await import("../app/api/admin/event-hosts/[id]/route");
    assert.equal(
      (
        await revoke(
          req("/api/admin/event-hosts/x", "DELETE", undefined, undefined, true),
          ctx(access.id),
        )
      ).status,
      200,
    );
    assert.equal(
      (await listHost(req("/api/host/events", "GET", undefined, hostSession)))
        .status,
      403,
      "revocation applies to existing sessions",
    );
    assert.equal(
      (
        await proxy(
          new NextRequest("http://localhost/api/host/events", {
            headers: { cookie: `${VENUE_SESSION_COOKIE}=${hostSession}` },
          }),
        )
      ).status,
      403,
    );
    await db.query("UPDATE events SET status='cancelled' WHERE id=$1", [
      eventId,
    ]);
    assert.equal(
      (
        await create(
          req("/api/events/x/registrations", "POST", details, sessions[loser]),
          ctx(eventId),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await data<{ ticket: Ticket }>(
          await ticket(req("/api/events/x/tickets/x"), {
            params: Promise.resolve({
              id: String(eventId),
              token: paid.ticketToken,
            }),
          }),
        )
      ).ticket.status,
      "cancelled",
    );
    console.log(
      `PASS immediate revocation, cancellation guards; all ${providerCalls} provider requests were intercepted locally (no real registrations, charges or messages)`,
    );

    // Lost browser callback and a late payment after its seat has been sold.
    const extra = (
      await db.query<{
        id: number;
      }>(`INSERT INTO events(title,summary,category,start_at,end_at,primary_source_url,source_type,status,city)
      VALUES('Isolated payment recovery','Test only','arts',now()+interval '10 days',now()+interval '10 days 2 hours','https://example.com/isolated','curator','live','Chennai') RETURNING id`)
    ).rows[0].id;
    await db.query(
      `INSERT INTO hosted_events(event_id,host_name,price_paise,capacity,registration_state,description,refund_policy,terms)
      VALUES($1,'Test organiser',29900,2,'open','Synthetic test only','Test refund policy','["Test terms"]')`,
      [extra],
    );
    const recoveryOrders: CreatedRegistration[] = [];
    for (let i = 0; i < 2; i++) {
      const r = await create(
        req(
          "/api/events/x/registrations",
          "POST",
          {
            name: `Guest ${i}`,
            email: `guest${i}@example.com`,
            whatsappOptIn: false,
          },
          sessions[i],
        ),
        ctx(extra),
      );
      assert.equal(r.status, 200, await r.clone().text());
      recoveryOrders.push(await data<CreatedRegistration>(r));
    }
    await assert.rejects(
      () =>
        saveHostedEventSettings({
          eventId: extra,
          hostName: "Test organiser",
          pricePaise: 29900,
          capacity: 1,
          registrationState: "open",
          description: "Synthetic test only",
          refundPolicy: "Test refund policy",
          terms: ["Test terms"],
        }),
      /Capacity cannot be lower/,
    );
    await db.query(
      "UPDATE event_registrations SET hold_until=now()-interval '1 minute' WHERE event_id=$1 AND user_id=$2",
      [extra, userIds[0]],
    );
    await db.query("UPDATE hosted_events SET capacity=1 WHERE event_id=$1", [
      extra,
    ]); // fixture state after an expired hold
    const recovered: Payment = {
      id: "pay_recovered",
      order_id: recoveryOrders[1].orderId,
      amount: 29900,
      currency: "INR",
      status: "captured",
      fee: 700,
    };
    payments.set(recovered.id, recovered);
    // No client-side verify: My bookings recovers the captured order itself.
    const recoveredMine = await data<{ registrations: { eventId: number }[] }>(
      await mine(
        req("/api/me/event-registrations", "GET", undefined, sessions[1]),
      ),
    );
    assert.ok(recoveredMine.registrations.some((r) => r.eventId === extra));
    assert.equal(
      (
        await db.query(
          "SELECT n.id FROM event_notifications n JOIN event_registrations r ON r.id=n.registration_id WHERE r.event_id=$1",
          [extra],
        )
      ).rows.length,
      0,
      "opting out never queues a confirmation",
    );
    const late: Payment = {
      id: "pay_late",
      order_id: recoveryOrders[0].orderId,
      amount: 29900,
      currency: "INR",
      status: "authorized",
      fee: 700,
    };
    payments.set(late.id, late);
    const lateVerify = {
      registrationToken: recoveryOrders[0].registrationToken,
      razorpay_order_id: late.order_id,
      razorpay_payment_id: late.id,
      razorpay_signature: crypto
        .createHmac("sha256", "isolated-payment-secret")
        .update(`${late.order_id}|${late.id}`)
        .digest("hex"),
    };
    assert.equal(
      (
        await verify(
          req(
            "/api/events/x/registrations/verify",
            "POST",
            lateVerify,
            sessions[0],
          ),
          ctx(extra),
        )
      ).status,
      409,
    );
    assert.equal(
      late.status,
      "authorized",
      "a late authorised payment is not captured when no seat is available",
    );
    late.status = "captured";
    assert.equal(
      (
        await verify(
          req(
            "/api/events/x/registrations/verify",
            "POST",
            lateVerify,
            sessions[0],
          ),
          ctx(extra),
        )
      ).status,
      409,
    );
    const lateReg = (
      await db.query<{ status: string; ticket_token: string }>(
        "SELECT status,ticket_token FROM event_registrations WHERE order_id=$1",
        [late.order_id],
      )
    ).rows[0];
    assert.equal(lateReg.status, "payment_review");
    assert.equal(
      (
        await ticket(req("/api/events/x/tickets/x"), {
          params: Promise.resolve({
            id: String(extra),
            token: lateReg.ticket_token,
          }),
        })
      ).status,
      404,
      "a late captured payment does not issue an oversold ticket",
    );
    assert.equal((await getHostedEventInfo(extra))?.registeredCount, 1);
    console.log(
      "PASS active-hold capacity protection, lost-callback recovery, explicit opt-out, late-payment review and no oversold ticket",
    );

    const { gaInlineScript } = await import("../lib/client/analytics");
    for (const [search, expected] of [
      ["?ticket=secret", 0],
      ["?utm_source=scene", 2],
    ] as const) {
      const previewWindow = {
        location: { search },
        dataLayer: [] as unknown[],
      };
      runInNewContext(gaInlineScript("G-ISOLATED"), {
        window: previewWindow,
        dataLayer: previewWindow.dataLayer,
        URLSearchParams,
      });
      assert.equal(
        previewWindow.dataLayer.length,
        expected,
        "bearer ticket links never initialise analytics",
      );
    }
    console.log("PASS ticket-link analytics privacy");
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.__pgPool = oldPool;
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

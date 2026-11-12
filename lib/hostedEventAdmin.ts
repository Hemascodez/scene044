import { pool, query } from "@/lib/db";
import {
  eventIdValue,
  EventTicketError,
  getHostedEventInfo,
} from "@/lib/hostedEventData";
import { CHAPTER_LOUNGE_FIXTURE } from "@/lib/hostedEvents";
import { eventPath } from "@/lib/seo";

export async function hostedEventAdminCatalog() {
  return (
    await query(`SELECT e.id,e.title,e.status,e.start_at AS "startAt",e.category,e.gist,
    h.host_name AS "hostName",h.host_person AS "hostPerson",h.price_paise AS "pricePaise",h.capacity,
    h.registration_state AS "registrationState",h.description,h.gallery,h.quote,h.good_to_know AS "goodToKnow",
    h.refund_policy AS "refundPolicy",h.terms FROM events e LEFT JOIN hosted_events h ON h.event_id=e.id
    WHERE e.status<>'expired' ORDER BY e.start_at DESC NULLS LAST,e.id DESC LIMIT 500`)
  ).rows;
}

export async function saveHostedEventSettings(body: Record<string, unknown>) {
  const id = eventIdValue(body.eventId);
  const hostName =
    typeof body.hostName === "string" ? body.hostName.trim() : "";
  const hostPerson =
    typeof body.hostPerson === "string" ? body.hostPerson.trim() : "";
  const pricePaise = body.pricePaise;
  const capacity = body.capacity;
  const state = body.registrationState;
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const refund =
    typeof body.refundPolicy === "string" ? body.refundPolicy.trim() : "";
  const terms = body.terms;
  const gallery = body.gallery ?? [];
  const updateGist = Object.hasOwn(body, "gist");
  if (updateGist && (typeof body.gist !== "string" || !body.gist.trim() || body.gist.trim().length > 140))
    throw new EventTicketError("At a glance must be a sentence of 140 characters or fewer.");
  const updateQuote = Object.hasOwn(body, "quote");
  const quote = body.quote as Record<string, unknown> | null | undefined;
  if (updateQuote && quote !== null && (
    !quote || typeof quote !== "object" || Array.isArray(quote) ||
    typeof quote.text !== "string" || !quote.text.trim() || quote.text.length > 2000 ||
    typeof quote.by !== "string" || !quote.by.trim() || quote.by.length > 120 ||
    (quote.highlight !== undefined && (typeof quote.highlight !== "string" || !quote.highlight.trim() || quote.highlight.length > 300 || !quote.text.includes(quote.highlight)))
  )) throw new EventTicketError("Enter a review with its attribution and a highlight that appears in the review.");
  if (
    hostName.length < 2 ||
    hostName.length > 120 ||
    hostPerson.length > 120 ||
    !Number.isSafeInteger(pricePaise) ||
    Number(pricePaise) < 100 ||
    Number(pricePaise) > 10000000 ||
    !Number.isSafeInteger(capacity) ||
    Number(capacity) < 1 ||
    Number(capacity) > 10000 ||
    !["open", "closed", "sold_out"].includes(String(state)) ||
    description.length < 10 ||
    description.length > 20000 ||
    !refund ||
    refund.length > 1000 ||
    !Array.isArray(terms) ||
    terms.length < 1 ||
    terms.length > 40 ||
    terms.some((t) => typeof t !== "string" || !t.trim() || t.length > 3000) ||
    !Array.isArray(gallery) ||
    gallery.length > 7 ||
    gallery.some(
      (p) =>
        !p ||
        typeof p.src !== "string" ||
        !/^(\/events\/|\/venues\/|https:\/\/)/.test(p.src) ||
        typeof p.alt !== "string" ||
        !p.alt.trim() ||
        p.alt.length > 300,
    )
  )
    throw new EventTicketError(
      "Check the host, price, capacity, description, refund policy, terms and photo details.",
    );
  const existing = await getHostedEventInfo(id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const e = await client.query<{ id: number; title: string }>(
      "SELECT id,title FROM events WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!e.rows[0]) throw new EventTicketError("Event not found.", 404);
    await client.query(
      "SELECT event_id FROM hosted_events WHERE event_id=$1 FOR UPDATE",
      [id],
    );
    const counts = await client.query<{ occupied: number }>(
      `SELECT count(*)::int AS occupied FROM event_registrations WHERE event_id=$1
      AND (status IN ('confirmed','checked_in') OR (status='pending' AND hold_until>now()))`,
      [id],
    );
    if (counts.rows[0]?.occupied > Number(capacity))
      throw new EventTicketError(
        "Capacity cannot be lower than confirmed tickets and active seat holds.",
        409,
      );
    await client.query(
      `INSERT INTO hosted_events(event_id,host_name,host_person,price_paise,capacity,registration_state,description,gallery,quote,good_to_know,refund_policy,terms)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb)
      ON CONFLICT(event_id) DO UPDATE SET host_name=EXCLUDED.host_name,host_person=EXCLUDED.host_person,price_paise=EXCLUDED.price_paise,
      capacity=EXCLUDED.capacity,registration_state=EXCLUDED.registration_state,description=EXCLUDED.description,gallery=EXCLUDED.gallery,
      quote=CASE WHEN $13::boolean THEN EXCLUDED.quote ELSE hosted_events.quote END,
      refund_policy=EXCLUDED.refund_policy,terms=EXCLUDED.terms,updated_at=now()`,
      [
        id,
        hostName,
        hostPerson || null,
        pricePaise,
        capacity,
        state,
        description,
        JSON.stringify(gallery),
        JSON.stringify(updateQuote ? quote : existing?.quote ?? null),
        JSON.stringify(existing?.goodToKnow ?? []),
        refund,
        JSON.stringify(terms),
        updateQuote,
      ],
    );
    await client.query(
      `UPDATE events SET price_type='paid',price_note=$2,primary_source_url=$3,
      gist=CASE WHEN $4::boolean THEN $5::text ELSE gist END,updated_at=now() WHERE id=$1`,
      [
        id,
        `₹${Number(pricePaise) / 100}`,
        `https://scene044.in${eventPath(e.rows[0])}`,
        updateGist,
        updateGist ? (body.gist as string).trim() : null,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Explicit curator action only. Real supplied content; zero registrations; never publishes. */
export async function prepareChapterLoungeDraft() {
  const event = CHAPTER_LOUNGE_FIXTURE;
  const h = event.hosted;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('scene044-chapter-lounge-2026-11-22'))",
    );
    let row = (
      await client.query<{ id: number; title: string }>(
        `SELECT id,title FROM events WHERE title=$1 AND organizer_name=$2 AND start_at=$3 LIMIT 1`,
        [event.title, event.organizerName, event.startAt],
      )
    ).rows[0];
    if (!row)
      row = (
        await client.query<{ id: number; title: string }>(
          `INSERT INTO events(title,summary,category,start_at,end_at,is_online,venue_name,venue_address,city,
      organizer_name,poster_image_url,price_type,price_note,primary_source_url,source_type,status,gist)
      VALUES($1,$2,'arts',$3,$4,false,$5,$6,'Chennai',$7,$8,'paid','₹299','https://scene044.in','curator','pending_review',$9)
      RETURNING id,title`,
          [
            event.title,
            event.summary,
            event.startAt,
            event.endAt,
            event.venueName,
            "119, Dr Radha Krishnan Salai, Dwarka Colony, Mylapore, Chennai, Tamil Nadu 600004",
            event.organizerName,
            event.posterImageUrl,
            event.gist,
          ],
        )
      ).rows[0];
    await client.query(
      `INSERT INTO hosted_events(event_id,host_name,host_person,price_paise,capacity,registration_state,description,gallery,quote,good_to_know,refund_policy,terms)
      VALUES($1,$2,$3,$4,$5,'closed',$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11::jsonb) ON CONFLICT(event_id) DO NOTHING`,
      [
        row.id,
        h.hostName,
        h.hostPerson,
        h.pricePaise,
        h.capacity,
        h.description,
        JSON.stringify(h.gallery),
        JSON.stringify(h.quote),
        JSON.stringify(h.goodToKnow),
        h.refundPolicy,
        JSON.stringify(h.terms),
      ],
    );
    await client.query(
      `UPDATE events SET primary_source_url=$2 WHERE id=$1 AND primary_source_url='https://scene044.in'`,
      [row.id, `https://scene044.in${eventPath(row)}`],
    );
    await client.query("COMMIT");
    return {
      eventId: row.id,
      notice:
        "Chapter Lounge draft prepared. No event was published and no registrations were created.",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

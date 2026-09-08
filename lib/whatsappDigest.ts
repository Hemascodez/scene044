import { query } from "@/lib/db";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import { normalizePhoneE164 } from "@/lib/subscribers";
import type { Category } from "@/lib/types";
import {
  buildWhatsappTemplatePayload,
  sendWhatsappTemplate,
  type WhatsappTemplateInput,
  type WhatsappTemplateSendResult,
} from "@/lib/whatsappSend";

export const DIGEST_TIME_ZONE = "Asia/Kolkata";
export const DIGEST_EVENT_LIMIT = 5;
export const META_TEMPLATE_BODY_LIMIT = 1024;

const DEFAULT_TEMPLATE_NAME = "scene044_weekly_digest";
const DEFAULT_TEMPLATE_LANGUAGE = "en_US";
const ATTEMPTED_STATUSES = ["sending", "unknown", "accepted", "sent", "delivered", "read"];

export type DigestMode = "dry-run" | "test" | "production";
export type DeliveryStatus = "accepted" | "sent" | "delivered" | "read" | "failed";

export interface DigestSubscriber {
  id: number;
  phone: string;
  name: string | null;
  categories: Category[];
}

export interface DigestEvent {
  id: number;
  title: string;
  category: Category;
  startAt: Date;
  registrationDeadline: Date | null;
  isOnline: boolean;
  venueName: string | null;
  venueAddress: string | null;
}

export interface DigestPreview {
  subscriberId: number | null;
  eventIds: number[];
  eventBlock: string;
}

export interface DigestRunResult {
  mode: DigestMode;
  campaignKey: string;
  windowStart: string;
  windowEnd: string;
  activeSubscribers: number;
  unsubscribed: number;
  eligible: number;
  skipped: number;
  skippedNoEvents: number;
  skippedAlreadyAttempted: number;
  accepted: number;
  delivered: number;
  failed: number;
  uncertain: number;
  aborted: boolean;
  abortReason: string | null;
  previews: DigestPreview[];
}

interface RunDependencies {
  sendTemplate?: typeof sendWhatsappTemplate;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function istDateParts(date: Date): DateParts {
  const values: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: DIGEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday-based key, so a manual rerun later in the same IST week stays idempotent. */
export function weeklyCampaignKey(now: Date): string {
  const parts = istDateParts(now);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const mondayOffset = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - mondayOffset);
  return `whatsapp-weekly:${isoDate(localDate)}`;
}

export function isEventInDigestWindow(startAt: Date, now: Date): boolean {
  const time = startAt.getTime();
  return time >= now.getTime() && time < now.getTime() + 7 * 24 * 60 * 60 * 1000;
}

export function categoryMatches(categories: readonly Category[], eventCategory: Category): boolean {
  return categories.length === 0 || categories.includes(eventCategory);
}

export function selectDigestEvents(
  candidates: readonly DigestEvent[],
  categories: readonly Category[],
  excludedEventIds: ReadonlySet<number> = new Set<number>(),
  limit = DIGEST_EVENT_LIMIT,
): DigestEvent[] {
  return candidates
    .filter((event) => categoryMatches(categories, event.category) && !excludedEventIds.has(event.id))
    .sort((a, b) => {
      const aDeadline = a.registrationDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDeadline = b.registrationDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
      return aDeadline - bDeadline || a.startAt.getTime() - b.startAt.getTime() || a.id - b.id;
    })
    .slice(0, limit);
}

function truncateUnicode(value: string, maxCharacters: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxCharacters) return value;
  if (maxCharacters <= 1) return characters.slice(0, maxCharacters).join("");
  return `${characters.slice(0, maxCharacters - 1).join("")}…`;
}

function singleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function formatDigestEvent(event: DigestEvent): string {
  const when = new Intl.DateTimeFormat("en-IN", {
    timeZone: DIGEST_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(event.startAt);
  const place = event.isOnline
    ? "Online"
    : singleLine(event.venueName ?? "") || singleLine(event.venueAddress ?? "") || "Chennai";
  return `• ${singleLine(event.title)} — ${when} — ${place}`;
}

function renderedTemplateBody(name: string, eventBlock: string, categoryLabel: string): string {
  return `Hi ${name}, here are your Chennai tech picks for this week:\n\n${eventBlock}\n\nSee more ${categoryLabel} events using the button below.\n\nYou subscribed to SCENE/044 updates. Reply STOP to unsubscribe.`;
}

export function buildDigestEventBlock(
  events: readonly DigestEvent[],
  name = "there",
  categoryLabel = "tech",
): string {
  if (events.length === 0) return "";
  const fixedLength = Array.from(renderedTemplateBody(name, "", categoryLabel)).length;
  const available = Math.max(1, META_TEMPLATE_BODY_LIMIT - fixedLength);
  const perLine = Math.max(1, Math.floor((available - (events.length - 1)) / events.length));
  return events.map((event) => truncateUnicode(formatDigestEvent(event), perLine)).join("\n");
}

export function digestTemplateInput(opts: {
  to: string;
  subscriberName?: string | null;
  events: readonly DigestEvent[];
  subscriberCategories?: readonly Category[];
  campaignKey: string;
  subscriberId?: number | null;
}): WhatsappTemplateInput {
  const name = truncateUnicode(opts.subscriberName?.trim().replace(/\s+/g, " ") || "there", 80);
  const onlyCategory = opts.subscriberCategories?.length === 1
    ? opts.subscriberCategories[0]
    : undefined;
  const destinationCategory = onlyCategory ?? opts.events[0]?.category ?? "tech";
  const field = getFieldCardForCategory(destinationCategory);
  const categorySlug = field?.key ?? destinationCategory;
  const categoryLabel = field?.label ?? destinationCategory;
  const templateName = process.env.WHATSAPP_WEEKLY_TEMPLATE_NAME?.trim() || DEFAULT_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_WEEKLY_TEMPLATE_LANGUAGE?.trim() || DEFAULT_TEMPLATE_LANGUAGE;
  const eventBlock = buildDigestEventBlock(opts.events, name, categoryLabel);
  return {
    to: opts.to,
    name: templateName,
    language,
    bodyParameters: [name, eventBlock, categoryLabel],
    urlButtonSuffix: categorySlug,
    opaqueCallbackData: `${opts.campaignKey}:${opts.subscriberId ?? "test"}`,
  };
}

async function loadCandidates(now: Date): Promise<DigestEvent[]> {
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { rows } = await query<{
    id: number;
    title: string;
    category: Category;
    start_at: Date;
    registration_deadline: Date | null;
    is_online: boolean;
    venue_name: string | null;
    venue_address: string | null;
  }>(
    `SELECT id, title, category, start_at, registration_deadline,
            is_online, venue_name, venue_address
       FROM events
      WHERE status IN ('live', 'updated')
        AND start_at >= $1
        AND start_at < $2
      ORDER BY start_at, id`,
    [now, windowEnd],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    startAt: new Date(row.start_at),
    registrationDeadline: row.registration_deadline ? new Date(row.registration_deadline) : null,
    isOnline: row.is_online,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
  }));
}

async function loadSubscribers(): Promise<{
  active: DigestSubscriber[];
  unsubscribed: number;
  attemptedBySubscriber: Map<number, Set<number>>;
}> {
  const [{ rows: subscribers }, { rows: statusCounts }, { rows: attemptedRows }] = await Promise.all([
    query<{ id: number; phone_e164: string; name: string | null; categories: Category[] }>(
      `SELECT id, phone_e164, name, categories
         FROM subscribers
        WHERE channel = 'whatsapp' AND status = 'active'
        ORDER BY id`,
    ),
    query<{ status: string; count: string }>(
      `SELECT status, count(*)::text AS count
         FROM subscribers
        WHERE channel = 'whatsapp'
        GROUP BY status`,
    ),
    query<{ subscriber_id: number; event_ids: number[] }>(
      `SELECT subscriber_id, event_ids
         FROM subscriber_sends
        WHERE channel = 'whatsapp'
          AND campaign_key LIKE 'whatsapp-weekly:%'
          AND status = ANY($1::text[])
          AND cardinality(event_ids) > 0`,
      [ATTEMPTED_STATUSES],
    ),
  ]);

  const attemptedBySubscriber = new Map<number, Set<number>>();
  for (const row of attemptedRows) {
    const eventIds = attemptedBySubscriber.get(row.subscriber_id) ?? new Set<number>();
    for (const eventId of row.event_ids) eventIds.add(eventId);
    attemptedBySubscriber.set(row.subscriber_id, eventIds);
  }
  return {
    active: subscribers.map((row) => ({
      id: row.id,
      phone: row.phone_e164,
      name: row.name,
      categories: row.categories,
    })),
    unsubscribed: Number(statusCounts.find((row) => row.status === "unsubscribed")?.count ?? 0),
    attemptedBySubscriber,
  };
}

async function reserveCampaignSend(opts: {
  subscriber: DigestSubscriber;
  campaignKey: string;
  templateInput: WhatsappTemplateInput;
  eventIds: number[];
}): Promise<number | null> {
  const payload = buildWhatsappTemplatePayload(opts.templateInput);
  const { rows } = await query<{ id: number }>(
    `INSERT INTO subscriber_sends
       (subscriber_id, channel, template_name, provider, campaign_key,
        event_ids, template_payload, status)
     SELECT id, 'whatsapp', $2, 'meta', $3, $4, $5::jsonb, 'queued'
       FROM subscribers
      WHERE id = $1 AND channel = 'whatsapp' AND status = 'active'
     ON CONFLICT (subscriber_id, campaign_key) WHERE campaign_key IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [
      opts.subscriber.id,
      opts.templateInput.name,
      opts.campaignKey,
      opts.eventIds,
      JSON.stringify(payload),
    ],
  );
  return rows[0]?.id ?? null;
}

async function loadTestSubscriber(phone: string): Promise<DigestSubscriber | null> {
  const { rows } = await query<{
    id: number;
    phone_e164: string;
    name: string | null;
    categories: Category[];
  }>(
    `SELECT id, phone_e164, name, categories
       FROM subscribers
      WHERE channel = 'whatsapp' AND status = 'active' AND phone_e164 = $1`,
    [phone],
  );
  const row = rows[0];
  return row
    ? { id: row.id, phone: row.phone_e164, name: row.name, categories: row.categories }
    : null;
}

async function markAttempt(sendId: number): Promise<void> {
  await query(
    `UPDATE subscriber_sends
        SET status = 'sending', attempt_count = attempt_count + 1,
            error = NULL, updated_at = now()
      WHERE id = $1`,
    [sendId],
  );
}

async function markAccepted(sendId: number, subscriberId: number, providerMessageId: string): Promise<void> {
  await Promise.all([
    query(
      `UPDATE subscriber_sends
          SET status = 'accepted', provider_message_id = $2,
              accepted_at = COALESCE(accepted_at, now()), error = NULL,
              updated_at = now()
        WHERE id = $1`,
      [sendId, providerMessageId],
    ),
    query("UPDATE subscribers SET last_sent_at = now() WHERE id = $1", [subscriberId]),
  ]);
}

async function markNotAccepted(
  sendId: number,
  status: "failed" | "unknown",
  error: string,
): Promise<void> {
  await query(
    `UPDATE subscriber_sends
        SET status = $2, error = $3,
            failed_at = CASE WHEN $2 = 'failed' THEN COALESCE(failed_at, now()) ELSE failed_at END,
            updated_at = now()
      WHERE id = $1`,
    [sendId, status, error.slice(0, 2000)],
  );
}

async function loadCampaignStatusTotals(campaignKey: string): Promise<{
  accepted: number;
  delivered: number;
  failed: number;
  uncertain: number;
}> {
  const { rows } = await query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
       FROM subscriber_sends
      WHERE channel = 'whatsapp' AND campaign_key = $1
      GROUP BY status`,
    [campaignKey],
  );
  const count = (statuses: string[]) => rows
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + Number(row.count), 0);
  return {
    accepted: count(["accepted", "sent", "delivered", "read"]),
    delivered: count(["delivered", "read"]),
    failed: count(["failed"]),
    uncertain: count(["unknown", "sending"]),
  };
}

export async function sendWhatsappTemplateWithRetries(opts: {
  input: WhatsappTemplateInput;
  sendId?: number;
  sendTemplate: typeof sendWhatsappTemplate;
  sleep: (milliseconds: number) => Promise<void>;
}): Promise<WhatsappTemplateSendResult> {
  let result: WhatsappTemplateSendResult = { ok: false, kind: "unknown", error: "No attempt made" };
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (opts.sendId) await markAttempt(opts.sendId);
    result = await opts.sendTemplate(opts.input);
    if (result.ok || result.kind !== "retryable" || attempt === 3) return result;
    await opts.sleep(500 * 2 ** (attempt - 1));
  }
  return result;
}

function baseResult(mode: DigestMode, now: Date, campaignKey: string): DigestRunResult {
  return {
    mode,
    campaignKey,
    windowStart: now.toISOString(),
    windowEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    activeSubscribers: 0,
    unsubscribed: 0,
    eligible: 0,
    skipped: 0,
    skippedNoEvents: 0,
    skippedAlreadyAttempted: 0,
    accepted: 0,
    delivered: 0,
    failed: 0,
    uncertain: 0,
    aborted: false,
    abortReason: null,
    previews: [],
  };
}

export async function runWhatsappDigest(
  mode: DigestMode,
  options: { now?: Date } = {},
  dependencies: RunDependencies = {},
): Promise<DigestRunResult> {
  const now = options.now ?? new Date();
  const campaignKey = mode === "test"
    ? `whatsapp-weekly-test:${now.toISOString()}`
    : weeklyCampaignKey(now);
  const result = baseResult(mode, now, campaignKey);
  const sendTemplate = dependencies.sendTemplate ?? sendWhatsappTemplate;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  if (mode === "production" && process.env.WHATSAPP_DIGEST_ENABLED !== "true") {
    throw new Error("WhatsApp digest is disabled; set WHATSAPP_DIGEST_ENABLED=true only after the template test succeeds");
  }

  const candidates = await loadCandidates(now);
  if (mode === "test") {
    const rawRecipient = process.env.WHATSAPP_TEST_RECIPIENT?.trim() ?? "";
    const recipient = normalizePhoneE164(rawRecipient);
    if (!recipient) throw new Error("WHATSAPP_TEST_RECIPIENT must be a valid WhatsApp phone number");
    const subscriber = await loadTestSubscriber(recipient);
    if (!subscriber) {
      throw new Error("WHATSAPP_TEST_RECIPIENT must first opt in and be an active WhatsApp subscriber");
    }
    result.activeSubscribers = 1;
    const events = selectDigestEvents(candidates, subscriber.categories);
    if (events.length === 0) {
      result.skipped = 1;
      result.skippedNoEvents = 1;
      return result;
    }
    result.eligible = 1;
    const input = digestTemplateInput({
      to: recipient,
      subscriberName: subscriber.name,
      events,
      subscriberCategories: subscriber.categories,
      campaignKey,
      subscriberId: subscriber.id,
    });
    const eventIds = events.map((event) => event.id);
    result.previews.push({ subscriberId: subscriber.id, eventIds, eventBlock: input.bodyParameters[1] });
    const sendId = await reserveCampaignSend({ subscriber, campaignKey, templateInput: input, eventIds });
    if (!sendId) {
      result.skipped = 1;
      result.skippedAlreadyAttempted = 1;
      return result;
    }
    const sendResult = await sendWhatsappTemplateWithRetries({ input, sendId, sendTemplate, sleep });
    if (sendResult.ok) {
      await markAccepted(sendId, subscriber.id, sendResult.providerMessageId);
      result.accepted = 1;
    } else if (sendResult.kind === "unknown") {
      await markNotAccepted(sendId, "unknown", sendResult.error);
      result.uncertain = 1;
    } else {
      await markNotAccepted(sendId, "failed", sendResult.error);
      result.failed = 1;
      result.aborted = sendResult.kind === "fatal";
      result.abortReason = sendResult.kind === "fatal" ? sendResult.error : null;
    }
    return result;
  }

  const subscriberData = await loadSubscribers();
  result.activeSubscribers = subscriberData.active.length;
  result.unsubscribed = subscriberData.unsubscribed;

  for (const subscriber of subscriberData.active) {
    const events = selectDigestEvents(
      candidates,
      subscriber.categories,
      subscriberData.attemptedBySubscriber.get(subscriber.id),
    );
    if (events.length === 0) {
      result.skipped++;
      result.skippedNoEvents++;
      continue;
    }
    result.eligible++;
    const input = digestTemplateInput({
      to: subscriber.phone,
      subscriberName: subscriber.name,
      events,
      subscriberCategories: subscriber.categories,
      campaignKey,
      subscriberId: subscriber.id,
    });
    result.previews.push({
      subscriberId: subscriber.id,
      eventIds: events.map((event) => event.id),
      eventBlock: input.bodyParameters[1],
    });
    if (mode === "dry-run") continue;

    const sendId = await reserveCampaignSend({
      subscriber,
      campaignKey,
      templateInput: input,
      eventIds: events.map((event) => event.id),
    });
    if (!sendId) {
      result.skipped++;
      result.skippedAlreadyAttempted++;
      continue;
    }

    const sendResult = await sendWhatsappTemplateWithRetries({ input, sendId, sendTemplate, sleep });
    if (sendResult.ok) {
      await markAccepted(sendId, subscriber.id, sendResult.providerMessageId);
      result.accepted++;
      continue;
    }
    if (sendResult.kind === "unknown") {
      await markNotAccepted(sendId, "unknown", sendResult.error);
      result.uncertain++;
      continue;
    }

    await markNotAccepted(sendId, "failed", sendResult.error);
    result.failed++;
    if (sendResult.kind === "fatal") {
      result.aborted = true;
      result.abortReason = sendResult.error;
      break;
    }
  }

  if (mode === "production") {
    const totals = await loadCampaignStatusTotals(campaignKey);
    result.accepted = totals.accepted;
    result.delivered = totals.delivered;
    result.failed = totals.failed;
    result.uncertain = totals.uncertain;
  }

  return result;
}

/** Applies Meta delivery callbacks without allowing replayed/out-of-order statuses to regress. */
export async function recordWhatsappDeliveryStatus(opts: {
  providerMessageId: string;
  status: DeliveryStatus;
  occurredAt?: Date;
  error?: string | null;
}): Promise<boolean> {
  if (!opts.providerMessageId) return false;
  const occurredAt = opts.occurredAt && !Number.isNaN(opts.occurredAt.getTime()) ? opts.occurredAt : new Date();
  const { rowCount } = await query(
    `UPDATE subscriber_sends
        SET status = CASE
              WHEN $2 = 'failed' AND status NOT IN ('delivered', 'read') THEN 'failed'
              WHEN $2 <> 'failed' AND
                   CASE $2
                     WHEN 'accepted' THEN 1 WHEN 'sent' THEN 2
                     WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 0
                   END >
                   CASE status
                     WHEN 'accepted' THEN 1 WHEN 'sent' THEN 2
                     WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 0
                   END
                THEN $2
              ELSE status
            END,
            accepted_at = CASE WHEN $2 = 'accepted' THEN COALESCE(accepted_at, $3) ELSE accepted_at END,
            provider_sent_at = CASE WHEN $2 = 'sent' THEN COALESCE(provider_sent_at, $3) ELSE provider_sent_at END,
            delivered_at = CASE WHEN $2 = 'delivered' THEN COALESCE(delivered_at, $3) ELSE delivered_at END,
            read_at = CASE WHEN $2 = 'read' THEN COALESCE(read_at, $3) ELSE read_at END,
            failed_at = CASE WHEN $2 = 'failed' THEN COALESCE(failed_at, $3) ELSE failed_at END,
            error = CASE
              WHEN $2 = 'failed' AND $4::text IS NOT NULL THEN $4::text
              ELSE error
            END,
            provider_status_at = GREATEST(COALESCE(provider_status_at, $3), $3),
            updated_at = now()
      WHERE provider_message_id = $1`,
    [opts.providerMessageId, opts.status, occurredAt, opts.error?.slice(0, 2000) ?? null],
  );
  return (rowCount ?? 0) > 0;
}

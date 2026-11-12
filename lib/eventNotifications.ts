import crypto from "node:crypto";
import { query } from "@/lib/db";
import { EventTicketError } from "@/lib/hostedEventData";
import { eventPath } from "@/lib/seo";
import { sendWhatsappTemplate } from "@/lib/whatsappSend";

export const EVENT_TEMPLATE_KEYS = [
  "ticket",
  "day-before",
  "morning-of",
  "directions",
] as const;
type Kind = (typeof EVENT_TEMPLATE_KEYS)[number];
const LABELS: Record<Kind, string> = {
  ticket: "Your event ticket",
  "day-before": "Day-before reminder",
  "morning-of": "Morning-of reminder",
  directions: "Directions",
};
export const eventTemplateVariable = (kind: Kind) =>
  `WHATSAPP_EVENT_${kind.replaceAll("-", "_").toUpperCase()}_TEMPLATE_NAME`;
export function eventNotificationTemplateName(kind: Kind) {
  return process.env[eventTemplateVariable(kind)]?.trim() || null;
}
export function eventNotificationsEnabled() {
  return process.env.WHATSAPP_HOSTED_EVENTS_ENABLED === "true";
}

/** STOP also opts the account out of optional ticket updates and event reminders. */
export async function stopEventWhatsappUpdates(phone: string) {
  await query(
    `UPDATE event_registrations SET whatsapp_opt_in=false,updated_at=now() WHERE phone_e164=$1 AND whatsapp_opt_in`,
    [phone],
  );
}

export async function eventReminderStatus(eventId: number) {
  const event = (
    await query<{
      title: string;
      start_at: Date;
      venue_name: string;
      status: string;
    }>("SELECT title,start_at,venue_name,status FROM events WHERE id=$1", [
      eventId,
    ])
  ).rows[0];
  if (!event) throw new EventTicketError("Event not found.", 404);
  const count =
    (
      await query<{ count: number }>(
        `SELECT count(*)::int AS count FROM event_registrations
    WHERE event_id=$1 AND status IN ('confirmed','checked_in') AND whatsapp_opt_in`,
        [eventId],
      )
    ).rows[0]?.count ?? 0;
  const history = (
    await query(
      `SELECT s.id::text,s.template_key AS "templateName",s.requested_at AS "sentAt",
    count(n.id) FILTER(WHERE n.state IN ('accepted','delivered','read'))::int AS sent,
    count(n.id) FILTER(WHERE n.state IN ('delivered','read'))::int AS delivered,
    count(n.id) FILTER(WHERE n.state='failed')::int AS failed,
    count(n.id) FILTER(WHERE n.state IN ('pending','sending','unknown'))::int AS pending
    FROM event_reminder_runs s LEFT JOIN event_notifications n ON n.reminder_run_id=s.id WHERE s.event_id=$1
    GROUP BY s.id ORDER BY s.requested_at DESC`,
      [eventId],
    )
  ).rows;
  const templates = (["day-before", "morning-of", "directions"] as const).map(
    (key) => ({
      id: key,
      name: LABELS[key],
      preview: `Hi {name}, ${key === "directions" ? "here are the directions for" : key === "day-before" ? "a reminder for tomorrow:" : "see you today at"} ${event.title}. Your ticket: {link}`,
      audience: count,
      lastSentAt: history.find((r) => r.templateName === key)?.sentAt ?? null,
      available:
        eventNotificationsEnabled() &&
        Boolean(eventNotificationTemplateName(key)) &&
        ["live", "updated"].includes(event.status),
      unavailableReason:
        "Event WhatsApp messages need an approved template and the notification switch enabled.",
    }),
  );
  return { templates, history };
}

export async function queueEventReminder(
  eventId: number,
  templateKey: unknown,
  requestedBy: number | null,
) {
  if (!["day-before", "morning-of", "directions"].includes(String(templateKey)))
    throw new EventTicketError("Choose an available reminder.");
  const kind = templateKey as Kind;
  if (!eventNotificationsEnabled() || !eventNotificationTemplateName(kind))
    throw new EventTicketError(
      "This WhatsApp template is not enabled yet. No messages were sent.",
      409,
    );
  // One transactional command: the run and its exact opted-in audience commit together.
  const { rows } = await query<{ id: string; audience: number }>(
    `WITH run AS (
    INSERT INTO event_reminder_runs(event_id,template_key,requested_by)
    SELECT h.event_id,$2,$3 FROM hosted_events h JOIN events e ON e.id=h.event_id
    WHERE h.event_id=$1 AND e.status IN ('live','updated') AND COALESCE(e.end_at,e.start_at+interval '2 hours')>now()
    AND EXISTS(SELECT 1 FROM event_registrations r WHERE r.event_id=$1 AND r.status IN ('confirmed','checked_in') AND r.whatsapp_opt_in)
    ON CONFLICT(event_id,template_key) DO NOTHING RETURNING id
  ), queued AS (
    INSERT INTO event_notifications(registration_id,reminder_run_id,kind)
    SELECT r.id,run.id,$2 FROM event_registrations r CROSS JOIN run
    WHERE r.event_id=$1 AND r.status IN ('confirmed','checked_in') AND r.whatsapp_opt_in
    ON CONFLICT(registration_id,kind) DO NOTHING RETURNING id
  ) SELECT run.id::text,(SELECT count(*)::int FROM queued) AS audience FROM run`,
    [eventId, kind, requestedBy],
  );
  if (!rows[0])
    throw new EventTicketError(
      "This reminder was already queued, has no opted-in guests, or the event is closed. No duplicate messages were sent.",
      409,
    );
  return {
    id: rows[0].id,
    templateName: kind,
    sentAt: new Date().toISOString(),
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: rows[0].audience,
  };
}

type NotificationRow = {
  id: number;
  registration_id: number;
  kind: Kind;
  claim_token: string;
  attempts: number;
};
export async function drainEventNotifications(sender = sendWhatsappTemplate) {
  if (!eventNotificationsEnabled()) return;
  const enabled = EVENT_TEMPLATE_KEYS.filter((key) =>
    eventNotificationTemplateName(key),
  );
  if (!enabled.length) return;
  await query(`UPDATE event_notifications SET state='unknown',error='Delivery uncertain after worker restart',updated_at=now()
    WHERE state='sending' AND claimed_at<now()-interval '5 minutes'`);
  for (let i = 0; i < 20; i++) {
    const claim = crypto.randomUUID();
    const row = (
      await query<NotificationRow>(
        `UPDATE event_notifications SET state='sending',claim_token=$1,claimed_at=now(),attempts=attempts+1
      WHERE id=(SELECT id FROM event_notifications WHERE state='pending' AND next_attempt_at<=now() AND kind=ANY($2::text[])
      ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
        [claim, enabled],
      )
    ).rows[0];
    if (!row) break;
    const update = async (
      state: string,
      error: string | null,
      providerId: string | null = null,
      delay = 0,
    ) =>
      query(
        `UPDATE event_notifications
      SET state=$3,error=$4,provider_message_id=COALESCE($5,provider_message_id),next_attempt_at=now()+($6*interval '1 second'),updated_at=now()
      WHERE id=$1 AND claim_token=$2 AND state='sending'`,
        [row.id, claim, state, error, providerId, delay],
      );
    try {
      const r = (
        await query<{
          name: string;
          phone_e164: string;
          ticket_token: string;
          code: string;
          event_id: number;
          title: string;
          start_at: Date;
          venue_name: string;
          venue_address: string;
        }>(
          `SELECT r.name,r.phone_e164,r.ticket_token,r.code,r.event_id,e.title,e.start_at,e.venue_name,e.venue_address
        FROM event_registrations r JOIN events e ON e.id=r.event_id JOIN event_notifications n ON n.registration_id=r.id
        LEFT JOIN event_reminder_runs s ON s.id=n.reminder_run_id
        WHERE n.id=$1 AND r.whatsapp_opt_in AND r.status IN ('confirmed','checked_in') AND e.status IN ('live','updated')
        AND (s.requested_by IS NULL OR EXISTS(SELECT 1 FROM venue_users u JOIN event_host_access a ON a.phone_e164=u.phone_e164
          WHERE u.id=s.requested_by AND a.event_id=r.event_id AND a.revoked_at IS NULL))`,
          [row.id],
        )
      ).rows[0];
      if (!r) {
        await update(
          "skipped",
          "Registration cancelled, no consent, or host access revoked",
        );
        continue;
      }
      const when =
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(r.start_at)) + " IST";
      const result = await sender({
        to: r.phone_e164,
        name: eventNotificationTemplateName(row.kind)!,
        language: process.env.WHATSAPP_EVENT_TEMPLATE_LANGUAGE?.trim() || "en",
        bodyParameters: [
          r.name,
          r.title,
          when,
          row.kind === "directions"
            ? r.venue_address || r.venue_name
            : r.venue_name || "Venue to be confirmed",
          r.code,
        ],
        urlButtonSuffix: `${eventPath({ id: r.event_id, title: r.title }).split("/").at(-1)}/ticket?ticket=${r.ticket_token}`,
        opaqueCallbackData: `event-notification:${row.id}`,
      });
      if (result.ok) await update("accepted", null, result.providerMessageId);
      else if (result.kind === "retryable" && row.attempts < 5)
        await update(
          "pending",
          result.error.slice(0, 1000),
          null,
          Math.min(3600, 60 * 2 ** row.attempts),
        );
      else
        await update(
          result.kind === "unknown" ? "unknown" : "failed",
          result.error.slice(0, 1000),
        );
    } catch {
      await update(
        "unknown",
        "Send or persistence interrupted; check delivery before retrying",
      );
    }
  }
}

export async function recordEventNotificationReceipt(
  providerId: string,
  state: string,
  callbackData?: string,
) {
  if (!["sent", "delivered", "read", "failed"].includes(state)) return;
  const id =
    /^event-notification:([1-9][0-9]*)$/.exec(callbackData ?? "")?.[1] ?? null;
  await query(
    `UPDATE event_notifications SET state=CASE
    WHEN state='read' THEN state WHEN state='delivered' AND $2<>'read' THEN state
    WHEN $2='sent' THEN 'accepted' ELSE $2 END,provider_message_id=COALESCE(provider_message_id,$1),updated_at=now()
    WHERE (provider_message_id=$1 OR (id=$3::integer AND provider_message_id IS NULL)) AND state IN ('sending','accepted','delivered','read','unknown')`,
    [providerId, state, id],
  );
}

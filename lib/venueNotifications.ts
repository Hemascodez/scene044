/** Utility notifications only. Never reads subscriber lists or backfills bookings. */
import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { sendWhatsappTemplate, type WhatsappTemplateInput, type WhatsappTemplateSendResult } from '@/lib/whatsappSend';

export interface VenueNotification {
  id: string;
  kind: string;
  audience: 'organiser' | 'host' | 'partner';
  recipient: string;
  payload: { name: string; eventType: string; venueName: string; spaceName: string; date: string;
    time: string; people: number; code: string; amountPaise: number | null; actor: string; area: string };
  attempts: number;
  claim_token: string;
}

export function venueNotificationsEnabled(): boolean {
  return process.env.WHATSAPP_VENUE_NOTIFICATIONS_ENABLED === 'true';
}

/** Names, counts and language checked against Meta's approved templates, 8 Oct 2026. */
export function venueNotificationTemplate(row: VenueNotification): WhatsappTemplateInput | null {
  const p = row.payload;
  const date = row.kind === 'listing_received' ? '' : new Date(`${p.date}T${p.time}+05:30`);
  const when = date instanceof Date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true }).format(date) + ' IST' : '';
  const amount = p.amountPaise === null || p.amountPaise === undefined ? null
    : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(p.amountPaise / 100);
  let name: string;
  let bodyParameters: string[];
  switch (row.kind) {
    case 'requested':
      name = row.audience === 'host' ? 'scene044_new_booking_request' : 'scene044_booking_requested_v2';
      bodyParameters = row.audience === 'host' ? [p.eventType, when, String(p.people), p.name, p.code]
        : [p.name, p.eventType, p.venueName, when, String(p.people), p.code];
      break;
    case 'approved':
      // Quote-only rooms do not have a payable amount yet. Never claim ₹0 is due.
      if (amount === null) return null;
      name = 'scene044_booking_approved'; bodyParameters = [p.name, p.eventType, when, amount, p.code]; break;
    case 'confirmed':
      if (amount === null) return null;
      name = row.audience === 'host' ? 'scene044_host_booking_confirmed' : 'scene044_booking_confirmed';
      bodyParameters = row.audience === 'host' ? [p.code, p.name, when, amount] : [p.name, p.eventType, amount, when, p.code]; break;
    case 'declined':
      name = 'scene044_booking_declined'; bodyParameters = [p.name, p.eventType, when, p.code]; break;
    case 'cancelled':
      name = 'scene044_booking_cancelled'; bodyParameters = [p.name, p.code, p.actor, when, p.code]; break;
    case 'expired':
      name = 'scene044_booking_expired'; bodyParameters = [p.name, p.eventType, when, p.code]; break;
    case 'overrun':
      name = 'scene044_venue_overrun'; bodyParameters = [p.name, p.venueName, p.spaceName]; break;
    case 'listing_received':
      name = 'scene044_venue_listing_received'; bodyParameters = [p.name, p.venueName, p.area]; break;
    default: return null;
  }
  if (bodyParameters.some(value => !value?.trim())) return null;
  return { to: row.recipient, name, language: 'en', bodyParameters, opaqueCallbackData: `venue-notification:${row.id}` };
}

type Sender = (input: WhatsappTemplateInput) => Promise<WhatsappTemplateSendResult>;
export interface NotificationSweepResult { accepted: number; retried: number; skipped: number; failed: number; unknown: number; }

export async function drainVenueNotifications(sender: Sender = sendWhatsappTemplate): Promise<NotificationSweepResult> {
  const result: NotificationSweepResult = { accepted: 0, retried: 0, skipped: 0, failed: 0, unknown: 0 };
  if (!venueNotificationsEnabled()) return result;
  if (![process.env.WHATSAPP_ACCESS_TOKEN, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_GRAPH_API_VERSION].every(Boolean)) {
    console.error('Venue notifications paused: WhatsApp credentials are missing. Queue retained.'); return result;
  }
  // A process may die after Meta accepted a send. Do NOT automatically retry
  // abandoned claims: delivery is uncertain, not proof of failure.
  await query(`UPDATE venue_notifications SET state='unknown',error='Worker stopped during send; check Meta before retrying',updated_at=now()
    WHERE state='sending' AND claimed_at < now()-interval '5 minutes'`);
  for (let index = 0; index < 20; index++) {
    const token = randomUUID();
    const { rows } = await query<VenueNotification>(`UPDATE venue_notifications SET state='sending',claim_token=$1,
      claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=(
        SELECT id FROM venue_notifications WHERE state='pending' AND next_attempt_at<=now()
        ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, [token]);
    const row = rows[0];
    if (!row) break;
    const update = async (state: string, error: string | null, providerId: string | null = null, delay = 0) => {
      await query(`UPDATE venue_notifications SET state=$3,error=$4,provider_message_id=COALESCE($5,provider_message_id),
        next_attempt_at=now()+($6*interval '1 second'),updated_at=now()
        WHERE id=$1 AND claim_token=$2 AND state='sending'`, [row.id, token, state, error, providerId, delay]);
    };
    try {
      // Check permission again at dispatch, not just when the event was queued.
      const { rows: allowed } = await query<{ allowed: boolean }>(`SELECT (
        (n.booking_id IS NULL OR EXISTS (SELECT 1 FROM venue_bookings b WHERE b.id=n.booking_id AND b.archived_at IS NULL
          AND (n.audience='host' OR b.whatsapp_opt_in)
          AND CASE n.kind WHEN 'confirmed' THEN b.status IN ('confirmed','checked_in','completed')
            WHEN 'overrun' THEN b.status='checked_in' ELSE b.status=n.kind END))
        AND (n.audience<>'host' OR EXISTS (SELECT 1 FROM venue_host_access h WHERE h.venue_slug=n.venue_slug
          AND h.phone_e164=n.recipient AND h.revoked_at IS NULL))) AS allowed FROM venue_notifications n WHERE n.id=$1`, [row.id]);
      const template = venueNotificationTemplate(row);
      if (!allowed[0]?.allowed || !template) {
        await update('skipped', template ? 'Archived, no consent, revoked host, or superseded status' : 'No approved template for these details (for example, quote-only pricing)');
        result.skipped++; continue;
      }
      let sent: WhatsappTemplateSendResult;
      try { sent = await sender(template); }
      catch { sent = { ok: false, kind: 'unknown', error: 'Transport interrupted; delivery uncertain' }; }
      if (sent.ok) {
        await update('accepted', null, sent.providerMessageId); result.accepted++;
      } else if (sent.kind === 'retryable' && row.attempts < 5) {
        await update('pending', sent.error.slice(0, 2000), null, Math.min(3600, 60 * 2 ** (row.attempts - 1))); result.retried++;
      } else {
        const state = sent.kind === 'unknown' ? 'unknown' : 'failed';
        await update(state, sent.error.slice(0, 2000)); result[state]++;
        console.error(`Venue notification ${row.id}: ${state}`);
      }
    } catch (error) {
      // Preserve the claim. If the DB failed after a send, blindly retrying risks
      // a duplicate; the stale-claim sweep makes it visible as unknown instead.
      console.error(`Venue notification ${row.id}: persistence failed`, error instanceof Error ? error.name : 'Error');
    }
  }
  return result;
}

/** Queues one end-of-session notice atomically; concurrent sweeps are harmless. */
export async function queueVenueOverrunNotices(): Promise<number> {
  if (!venueNotificationsEnabled()) return 0;
  const result = await query(`UPDATE venue_bookings SET overrun_notified_at=now()
    WHERE status='checked_in' AND archived_at IS NULL AND ends_at<=now() AND overrun_notified_at IS NULL
      AND venue_slug='time-cafe'`);
  return result.rowCount ?? 0;
}

/** Meta webhook receipts update actual delivery, separate from API acceptance. */
export async function recordVenueNotificationReceipt(providerId: string, state: string, callbackData?: string, error?: string | null): Promise<void> {
  if (!['sent','delivered','read','failed'].includes(state)) return;
  const callbackId = /^venue-notification:([1-9][0-9]*)$/.exec(callbackData ?? '')?.[1] ?? null;
  await query(`UPDATE venue_notifications SET state=$2,provider_message_id=COALESCE(provider_message_id,$1),error=$4,updated_at=now()
    WHERE (provider_message_id=$1 OR (id=$3::bigint AND provider_message_id IS NULL))
      AND (state IN ('accepted','sending','unknown') OR (state='delivered' AND $2='read'))`,
    [providerId, state === 'sent' ? 'accepted' : state, callbackId, error?.slice(0, 2000) ?? null]);
}

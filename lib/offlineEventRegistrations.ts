import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { EventTicketError } from '@/lib/hostedEventData';
import { normalizeIndianPhone } from '@/lib/venueUserAuth';

export type OfflineGuest = { reference: string; name: string; phone?: string | null; amountPaise: number };
export type OfflineBatch = { eventId: number; expectedTitle: string; expectedTotalPaise: number; guests: OfflineGuest[] };

/** Atomic, retry-safe bookkeeping only. Never calls a payment or messaging provider. */
export async function recordOfflineEventRegistrations(input: OfflineBatch, apply = false) {
  if (!Number.isSafeInteger(input.eventId) || input.eventId < 1 || typeof input.expectedTitle !== 'string'
    || !Array.isArray(input.guests) || input.guests.length < 1 || input.guests.length > 50)
    throw new EventTicketError('Provide one hosted event and 1–50 offline guests.');
  const guests = input.guests.map(g => {
    const name = typeof g.name === 'string' ? g.name.trim() : '';
    const reference = typeof g.reference === 'string' ? g.reference.trim() : '';
    const phone = g.phone == null || g.phone === '' ? null : typeof g.phone === 'string' ? normalizeIndianPhone(g.phone) : null;
    if (name.length < 2 || name.length > 120 || !/^[a-zA-Z0-9:_-]{4,120}$/.test(reference)
      || !Number.isSafeInteger(g.amountPaise) || g.amountPaise < 100 || g.amountPaise > 10_000_000
      || (g.phone != null && g.phone !== '' && !phone)) throw new EventTicketError('Invalid offline guest details.');
    return { name, reference, phone, amountPaise: g.amountPaise };
  });
  const total = guests.reduce((sum, g) => sum + g.amountPaise, 0);
  if (!Number.isSafeInteger(input.expectedTotalPaise) || total !== input.expectedTotalPaise
    || new Set(guests.map(g => g.reference)).size !== guests.length
    || new Set(guests.filter(g => g.phone).map(g => g.phone)).size !== guests.filter(g => g.phone).length)
    throw new EventTicketError('The batch total or guest references do not match.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    // Serialize with online orders and payment confirmations, protecting held seats too.
    const event = (await client.query<{ title: string; status: string; end_at: Date }>('SELECT title,status,end_at FROM events WHERE id=$1 FOR UPDATE', [input.eventId])).rows[0];
    const hosted = (await client.query<{ capacity: number }>('SELECT capacity FROM hosted_events WHERE event_id=$1 FOR UPDATE', [input.eventId])).rows[0];
    if (!event || !hosted || event.title !== input.expectedTitle || !['live','updated'].includes(event.status)
      || !event.end_at || new Date(event.end_at).getTime() <= Date.now()) throw new EventTicketError('Event identity, availability or dates do not match.', 409);
    const before = (await client.query<{ registeredCount: number; heldCount: number; grossPaise: string }>(`SELECT
      count(*) FILTER(WHERE status IN ('confirmed','checked_in') AND paid_at IS NOT NULL)::int AS "registeredCount",
      count(*) FILTER(WHERE status='pending' AND hold_until>now())::int AS "heldCount",
      COALESCE(sum(amount_paise) FILTER(WHERE status IN ('confirmed','checked_in') AND paid_at IS NOT NULL),0)::text AS "grossPaise"
      FROM event_registrations WHERE event_id=$1`, [input.eventId])).rows[0];
    const pending: typeof guests = [];
    let existingCount = 0;
    for (const guest of guests) {
      const old = (await client.query<{ name: string; phone_e164: string | null; amount_paise: number; status: string; payment_source: string }>(
        'SELECT name,phone_e164,amount_paise,status,payment_source FROM event_registrations WHERE event_id=$1 AND offline_reference=$2', [input.eventId, guest.reference])).rows[0];
      if (old) {
        if (old.name !== guest.name || old.phone_e164 !== guest.phone || old.amount_paise !== guest.amountPaise
          || old.payment_source !== 'host_direct' || !['confirmed','checked_in'].includes(old.status))
          throw new EventTicketError('An offline reference already exists with different details.', 409);
        existingCount++; continue;
      }
      const duplicate = (await client.query(`SELECT id FROM event_registrations WHERE event_id=$1
        AND (lower(trim(name))=lower($2) OR ($3::text IS NOT NULL AND phone_e164=$3))
        AND status IN ('pending','confirmed','checked_in','payment_review') LIMIT 1`, [input.eventId, guest.name, guest.phone])).rows[0];
      if (duplicate) throw new EventTicketError('A guest may already be registered. Review before adding a duplicate.', 409);
      pending.push(guest);
    }
    if (before.registeredCount + before.heldCount + pending.length > hosted.capacity)
      throw new EventTicketError('These guests would exceed capacity or use an active online seat hold.', 409);
    if (apply) for (const guest of pending) await client.query(`INSERT INTO event_registrations
      (event_id,user_id,name,email,phone_e164,whatsapp_opt_in,registration_token,ticket_token,code,
       amount_paise,currency,status,payment_source,offline_reference,fee_paise,paid_at,hold_until)
      VALUES($1,NULL,$2,NULL,$3,false,$4,$5,$6,$7,'INR','confirmed','host_direct',$8,0,now(),now())`,
      [input.eventId,guest.name,guest.phone,crypto.randomBytes(32).toString('hex'),crypto.randomBytes(32).toString('hex'),
        `SCN-EVT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,guest.amountPaise,guest.reference]);
    const addedPaise = pending.reduce((sum, g) => sum + g.amountPaise, 0);
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return { applied: apply, eventId: input.eventId, title: event.title, beforeCount: before.registeredCount,
      beforeGrossPaise: Number(before.grossPaise), addedCount: pending.length, addedPaise, existingCount,
      registeredCount: before.registeredCount + (apply ? pending.length : 0),
      grossPaise: Number(before.grossPaise) + (apply ? addedPaise : 0),
      remainingSeats: hosted.capacity - before.registeredCount - (apply ? pending.length : 0) };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

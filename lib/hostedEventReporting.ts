import { query } from '@/lib/db';
import { EventTicketError } from '@/lib/hostedEventData';

export const REGISTRATION_FILTERS = ['all', 'paid', 'unpaid', 'checked_in', 'payment_review', 'cancelled'] as const;
export type RegistrationFilter = typeof REGISTRATION_FILTERS[number];
export interface CuratorRegistration {
  id: number; name: string; email: string | null; phone: string | null; code: string;
  paymentSource: 'razorpay' | 'host_direct';
  status: string; amountPaise: number; createdAt: string; paidAt: string | null;
  checkedInAt: string | null; holdUntil: string; hasOrder: boolean;
}
export interface HostedRegistrationReport {
  event: { id: number; title: string; capacity: number };
  summary: {
    registeredCount: number; checkedInCount: number; checkoutCount: number;
    activeUnpaidCount: number; expiredUnpaidCount: number; reviewCount: number;
    cancelledCount: number; grossPaise: number; waitlistCount: number;
    hostCollectedPaise: number; sceneCollectedPaise: number;
  };
  registrations: CuratorRegistration[];
  page: number; pageSize: number; total: number; fetchedAt: string;
}

/** Curator-only read model. Never returns ticket/registration tokens, signatures or gateway credentials. */
export async function hostedRegistrationReport(eventId: number, filter: RegistrationFilter, search: string, page: number): Promise<HostedRegistrationReport> {
  const { rows } = await query<HostedRegistrationReport['event'] & HostedRegistrationReport['summary']>(
    `SELECT e.id,e.title,h.capacity,
     count(r.id) FILTER(WHERE r.status IN ('confirmed','checked_in') AND r.paid_at IS NOT NULL)::int AS "registeredCount",
     count(r.id) FILTER(WHERE r.status='checked_in' AND r.paid_at IS NOT NULL)::int AS "checkedInCount",
     count(r.id) FILTER(WHERE r.order_id IS NOT NULL)::int AS "checkoutCount",
     count(r.id) FILTER(WHERE r.status='pending' AND r.paid_at IS NULL AND r.hold_until>now())::int AS "activeUnpaidCount",
     count(r.id) FILTER(WHERE r.status='pending' AND r.paid_at IS NULL AND r.hold_until<=now())::int AS "expiredUnpaidCount",
     count(r.id) FILTER(WHERE r.status='payment_review')::int AS "reviewCount",
     count(r.id) FILTER(WHERE r.status='cancelled')::int AS "cancelledCount",
     COALESCE(sum(r.amount_paise) FILTER(WHERE r.status IN ('confirmed','checked_in') AND r.paid_at IS NOT NULL),0)::text AS "grossPaise",
     COALESCE(sum(r.amount_paise) FILTER(WHERE r.status IN ('confirmed','checked_in') AND r.paid_at IS NOT NULL AND r.payment_source='host_direct'),0)::text AS "hostCollectedPaise",
     COALESCE(sum(r.amount_paise) FILTER(WHERE r.status IN ('confirmed','checked_in') AND r.paid_at IS NOT NULL AND r.payment_source='razorpay'),0)::text AS "sceneCollectedPaise",
     (SELECT count(*)::int FROM event_waitlist w WHERE w.event_id=e.id) AS "waitlistCount"
     FROM hosted_events h JOIN events e ON e.id=h.event_id
     LEFT JOIN event_registrations r ON r.event_id=e.id WHERE e.id=$1 GROUP BY e.id,h.event_id`, [eventId],
  );
  const row = rows[0];
  if (!row) throw new EventTicketError('Hosted event not found.', 404);
  const pageSize = 50;
  const pattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : '';
  const registrations = (await query<CuratorRegistration & { totalMatches: number }>(
    `SELECT id,name,email,phone_e164 AS phone,code,status,payment_source AS "paymentSource",amount_paise AS "amountPaise",
     created_at AS "createdAt",paid_at AS "paidAt",checked_in_at AS "checkedInAt",hold_until AS "holdUntil",
     (order_id IS NOT NULL) AS "hasOrder",count(*) OVER()::int AS "totalMatches"
     FROM event_registrations WHERE event_id=$1
     AND ($2='' OR concat_ws(' ',name,email,phone_e164,code) ILIKE $2)
     AND CASE $3::text
       WHEN 'paid' THEN status IN ('confirmed','checked_in') AND paid_at IS NOT NULL
       WHEN 'unpaid' THEN status='pending' AND paid_at IS NULL
       WHEN 'checked_in' THEN status='checked_in' AND paid_at IS NOT NULL
       WHEN 'payment_review' THEN status='payment_review'
       WHEN 'cancelled' THEN status='cancelled' ELSE true END
     ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`, [eventId, pattern, filter, pageSize, (page - 1) * pageSize],
  )).rows;
  const { id, title, capacity, ...summary } = row;
  const iso = (value: string) => new Date(value).toISOString();
  return {
    event: { id, title, capacity }, summary: { ...summary, grossPaise: Number(summary.grossPaise), hostCollectedPaise: Number(summary.hostCollectedPaise), sceneCollectedPaise: Number(summary.sceneCollectedPaise) },
    registrations: registrations.map(r => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone, code: r.code, status: r.status,
      amountPaise: r.amountPaise, hasOrder: r.hasOrder, paymentSource: r.paymentSource,
      createdAt: iso(r.createdAt), paidAt: r.paidAt ? iso(r.paidAt) : null,
      checkedInAt: r.checkedInAt ? iso(r.checkedInAt) : null, holdUntil: iso(r.holdUntil),
    })),
    page, pageSize, total: registrations[0]?.totalMatches ?? 0, fetchedAt: new Date().toISOString(),
  };
}

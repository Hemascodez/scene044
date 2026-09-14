import { query } from "@/lib/db";
import { REVIEW_TAGS, type ReviewTag } from "@/lib/venueReviewTags";

export { REVIEW_TAGS, type ReviewTag };

/**
 * Server-side venue bookings.
 *
 * Replaces the browser-only store (lib/client/venueBookingStore.ts) because the
 * two things this feature exists for are inherently cross-device: the organizer
 * shows a check-in QR on their phone and the venue owner scans it on theirs, and
 * a review written by the organizer has to appear in the owner's dashboard.
 */

export type VenueBookingStatus =
  | "requested"
  | "approved"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired";

export type ReviewSource = "booking" | "self_reported";
export type ReviewStatus = "pending" | "published" | "rejected";

export const MIN_REVIEW_PHOTOS = 2;

export interface VenueBooking {
  id: number;
  code: string;
  checkinToken: string;
  venueSlug: string;
  venueName: string;
  spaceId: string;
  spaceName: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  people: number;
  eventType: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  trustType: string | null;
  trustUrl: string | null;
  hourlyRate: number | null;
  total: number | null;
  status: VenueBookingStatus;
  checkedInAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface VenueBookingOrder {
  id: number;
  description: string;
  amount: number;
  createdAt: string;
}

export interface VenueReview {
  id: number;
  /** Null for a self-reported review — it was never tied to a SCENE booking. */
  bookingId: number | null;
  venueSlug: string;
  rating: number;
  tags: string[];
  comment: string | null;
  photoIds: number[];
  photoConsent: boolean;
  source: ReviewSource;
  status: ReviewStatus;
  createdAt: string;
  /** Booking-backed: joined from venue_bookings. Self-reported: the reviewer
   *  typed these directly, since there is no booking row to join. */
  organizerName?: string;
  eventType?: string;
  eventDate?: string;
}

/*
 * Human-readable booking code.
 *
 * Read aloud at reception and written on order slips, so the alphabet drops
 * every character that gets confused when handwritten or spoken: I/1, O/0, S/5,
 * B/8, Z/2. What's left is unambiguous in both directions.
 */
const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
const CODE_LENGTH = 6;

export function newBookingCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // Modulo bias is irrelevant here: this is a collision-avoidance label, not a
  // secret. The unguessable half of the pair is checkin_token.
  const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `SCN-${body}`;
}

/** Unguessable capability token — the QR payload. Same CSPRNG hex shape as
 *  lib/subscribers.ts's unsubscribe token. */
export function newCheckinToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const BOOKING_COLUMNS = `
  id, code, checkin_token AS "checkinToken",
  venue_slug AS "venueSlug", venue_name AS "venueName",
  space_id AS "spaceId", space_name AS "spaceName",
  event_date AS "eventDate", start_time AS "startTime",
  duration_hours AS "durationHours", people, event_type AS "eventType", description,
  organizer_name AS "organizerName", organizer_email AS "organizerEmail",
  organizer_phone AS "organizerPhone",
  trust_type AS "trustType", trust_url AS "trustUrl",
  hourly_rate AS "hourlyRate", total, status,
  checked_in_at AS "checkedInAt", ends_at AS "endsAt", completed_at AS "completedAt",
  created_at AS "createdAt"
`;

export interface NewBookingInput {
  venueSlug: string;
  venueName: string;
  spaceId: string;
  spaceName: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  people: number;
  eventType: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  trustType?: string | null;
  trustUrl?: string | null;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
  hourlyRate: number | null;
  total: number | null;
}

/**
 * Creates a request. Retries once on the (vanishingly unlikely) code collision
 * rather than surfacing a unique-violation to the organizer.
 */
export async function createVenueBooking(input: NewBookingInput): Promise<VenueBooking> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { rows } = await query<VenueBooking>(
        `INSERT INTO venue_bookings
           (code, checkin_token, venue_slug, venue_name, space_id, space_name,
            event_date, start_time, duration_hours, people, event_type, description,
            organizer_name, organizer_email, organizer_phone, trust_type, trust_url,
            whatsapp_opt_in, email_opt_in, hourly_rate, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING ${BOOKING_COLUMNS}`,
        [
          newBookingCode(),
          newCheckinToken(),
          input.venueSlug,
          input.venueName,
          input.spaceId,
          input.spaceName,
          input.eventDate,
          input.startTime,
          input.durationHours,
          input.people,
          input.eventType,
          input.description,
          input.organizerName,
          input.organizerEmail,
          input.organizerPhone,
          input.trustType ?? null,
          input.trustUrl ?? null,
          input.whatsappOptIn ?? false,
          input.emailOptIn ?? false,
          input.hourlyRate,
          input.total,
        ],
      );
      return rows[0];
    } catch (err) {
      const isCodeCollision = String(err).includes("venue_bookings_code_key");
      if (!isCodeCollision || attempt === 2) throw err;
    }
  }
  throw new Error("could not allocate a unique booking code");
}

export async function getBookingByCode(code: string): Promise<VenueBooking | null> {
  const { rows } = await query<VenueBooking>(
    `SELECT ${BOOKING_COLUMNS} FROM venue_bookings WHERE code = $1`,
    [code.trim().toUpperCase()],
  );
  return rows[0] ?? null;
}

export async function getBookingByCheckinToken(token: string): Promise<VenueBooking | null> {
  const { rows } = await query<VenueBooking>(
    `SELECT ${BOOKING_COLUMNS} FROM venue_bookings WHERE checkin_token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function listVenueBookings(venueSlug: string): Promise<VenueBooking[]> {
  const { rows } = await query<VenueBooking>(
    `SELECT ${BOOKING_COLUMNS} FROM venue_bookings
      WHERE venue_slug = $1
      ORDER BY event_date DESC, id DESC
      LIMIT 200`,
    [venueSlug],
  );
  return rows;
}

/**
 * Which transitions are legal.
 *
 * Encoded rather than checked ad hoc at each call site: the host dashboard, the
 * organizer's confirm button and the check-in scan all move the same row, and
 * without this a double-tapped scan or a stale tab could walk a completed
 * booking backwards.
 */
const ALLOWED_TRANSITIONS: Record<VenueBookingStatus, VenueBookingStatus[]> = {
  requested: ["approved", "declined", "cancelled", "expired"],
  approved: ["confirmed", "cancelled", "expired"],
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["completed"],
  completed: [],
  declined: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: VenueBookingStatus, to: VenueBookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function setBookingStatus(
  id: number,
  to: VenueBookingStatus,
): Promise<VenueBooking | null> {
  const { rows } = await query<VenueBooking>(
    `UPDATE venue_bookings
        SET status = $2, updated_at = now()
      WHERE id = $1 AND status = ANY($3::text[])
      RETURNING ${BOOKING_COLUMNS}`,
    [
      id,
      to,
      Object.entries(ALLOWED_TRANSITIONS)
        .filter(([, allowed]) => allowed.includes(to))
        .map(([from]) => from),
    ],
  );
  return rows[0] ?? null;
}

/**
 * Starts the event clock.
 *
 * `ends_at` is derived here, in SQL, from the moment of the scan — not from the
 * booked start time. An event that starts 25 minutes late still gets its full
 * two hours, which is the only version a venue owner can defend to a customer.
 * The status guard makes a double scan a no-op instead of restarting the timer.
 */
export async function checkInBooking(id: number): Promise<VenueBooking | null> {
  const { rows } = await query<VenueBooking>(
    `UPDATE venue_bookings
        SET status = 'checked_in',
            checked_in_at = now(),
            ends_at = now() + (duration_hours * interval '1 hour'),
            updated_at = now()
      WHERE id = $1 AND status = 'confirmed'
      RETURNING ${BOOKING_COLUMNS}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function completeBooking(id: number): Promise<VenueBooking | null> {
  const { rows } = await query<VenueBooking>(
    `UPDATE venue_bookings
        SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'checked_in'
      RETURNING ${BOOKING_COLUMNS}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function addBookingOrder(
  bookingId: number,
  description: string,
  amount: number,
): Promise<VenueBookingOrder | null> {
  // Only a running or finished event can accrue orders — attaching food to a
  // booking nobody has arrived for means the code was mistyped.
  const { rows } = await query<VenueBookingOrder>(
    `INSERT INTO venue_booking_orders (booking_id, description, amount)
     SELECT id, $2, $3 FROM venue_bookings
      WHERE id = $1 AND status IN ('checked_in','completed')
     RETURNING id, description, amount, created_at AS "createdAt"`,
    [bookingId, description, amount],
  );
  return rows[0] ?? null;
}

export async function listBookingOrders(bookingId: number): Promise<VenueBookingOrder[]> {
  const { rows } = await query<VenueBookingOrder>(
    `SELECT id, description, amount, created_at AS "createdAt"
       FROM venue_booking_orders WHERE booking_id = $1 ORDER BY created_at, id`,
    [bookingId],
  );
  return rows;
}

/** Order totals per booking, for the host's running-tab view. */
export async function orderTotalsByBooking(venueSlug: string): Promise<Map<number, number>> {
  const { rows } = await query<{ booking_id: number; total: string }>(
    `SELECT o.booking_id, sum(o.amount)::text AS total
       FROM venue_booking_orders o
       JOIN venue_bookings b ON b.id = o.booking_id
      WHERE b.venue_slug = $1
      GROUP BY o.booking_id`,
    [venueSlug],
  );
  return new Map(rows.map((row) => [row.booking_id, Number(row.total)]));
}

/** Events past their booked finish that haven't been pinged yet. */
export async function findOverrunBookings(): Promise<VenueBooking[]> {
  const { rows } = await query<VenueBooking>(
    `SELECT ${BOOKING_COLUMNS} FROM venue_bookings
      WHERE status = 'checked_in'
        AND overrun_notified_at IS NULL
        AND ends_at IS NOT NULL
        AND ends_at <= now()
      ORDER BY ends_at
      LIMIT 50`,
  );
  return rows;
}

/** Claims the notification before sending it, so two overlapping sweeps cannot
 *  both message the owner about the same booking. */
export async function claimOverrunNotification(id: number): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE venue_bookings
        SET overrun_notified_at = now(), updated_at = now()
      WHERE id = $1 AND overrun_notified_at IS NULL`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

// ------------------------------------------------------------------- reviews

export interface NewReviewInput {
  bookingId: number;
  venueSlug: string;
  rating: number;
  tags: string[];
  comment: string | null;
  photoIds: number[];
  photoConsent: boolean;
}

const REVIEW_COLUMNS = `
  id, booking_id AS "bookingId", venue_slug AS "venueSlug", rating, tags,
  comment, photo_ids AS "photoIds", photo_consent AS "photoConsent",
  source, status, created_at AS "createdAt"
`;

/**
 * Records a booking-backed review.
 *
 * The INSERT ... SELECT is the gate: the row only materialises if that booking
 * is actually `completed`. Combined with the unique index on booking_id, a
 * review cannot exist without a finished booking behind it and cannot be
 * submitted twice — which is what makes "reviews only come from completed
 * bookings" true by construction rather than by promise. Publishes
 * immediately: the gate it just passed through is the proof.
 */
export async function createVenueReview(input: NewReviewInput): Promise<VenueReview | null> {
  const { rows } = await query<VenueReview>(
    `INSERT INTO venue_reviews
       (booking_id, venue_slug, rating, tags, comment, photo_ids, photo_consent, source, status)
     SELECT id, $2, $3, $4, $5, $6, $7, 'booking', 'published' FROM venue_bookings
      WHERE id = $1 AND status = 'completed'
     ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO NOTHING
     RETURNING ${REVIEW_COLUMNS}`,
    [
      input.bookingId,
      input.venueSlug,
      input.rating,
      input.tags,
      input.comment,
      input.photoIds,
      input.photoConsent,
    ],
  );
  return rows[0] ?? null;
}

export interface NewSelfReportedReviewInput {
  venueSlug: string;
  reviewerName: string;
  eventType: string | null;
  rating: number;
  tags: string[];
  comment: string | null;
  photoIds: number[];
  photoConsent: boolean;
}

/**
 * Records a review from someone who hosted at the venue without going through
 * a SCENE booking — "already hosted here? add your review" on the venue page.
 *
 * There is no booking to gate this on, so the thing that made booking-backed
 * reviews trustworthy by construction (the completed-booking check) is
 * replaced with a human one: this always lands `pending`, invisible to
 * listVenueReviews' public callers until a curator approves it.
 */
export async function createSelfReportedReview(
  input: NewSelfReportedReviewInput,
): Promise<VenueReview> {
  const { rows } = await query<VenueReview>(
    `INSERT INTO venue_reviews
       (venue_slug, reviewer_name, event_type, rating, tags, comment, photo_ids, photo_consent,
        source, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'self_reported','pending')
     RETURNING ${REVIEW_COLUMNS}, reviewer_name AS "organizerName", event_type AS "eventType"`,
    [
      input.venueSlug,
      input.reviewerName,
      input.eventType,
      input.rating,
      input.tags,
      input.comment,
      input.photoIds,
      input.photoConsent,
    ],
  );
  return rows[0];
}

/** Published reviews for the public venue page — the only status visitors
 *  ever see, whichever source they came from. */
export async function listVenueReviews(venueSlug: string, limit = 50): Promise<VenueReview[]> {
  const { rows } = await query<VenueReview>(
    `SELECT r.id, r.booking_id AS "bookingId", r.venue_slug AS "venueSlug", r.rating, r.tags,
            r.comment, r.photo_ids AS "photoIds", r.photo_consent AS "photoConsent",
            r.source, r.status, r.created_at AS "createdAt",
            COALESCE(b.organizer_name, r.reviewer_name) AS "organizerName",
            COALESCE(b.event_type, r.event_type) AS "eventType",
            b.event_date AS "eventDate"
       FROM venue_reviews r
       LEFT JOIN venue_bookings b ON b.id = r.booking_id
      WHERE r.venue_slug = $1 AND r.status = 'published'
      ORDER BY r.created_at DESC
      LIMIT $2`,
    [venueSlug, limit],
  );
  return rows;
}

/** Self-reported reviews awaiting a curator's approve/reject. */
export async function listPendingReviews(limit = 100): Promise<VenueReview[]> {
  const { rows } = await query<VenueReview>(
    `SELECT ${REVIEW_COLUMNS}, reviewer_name AS "organizerName", event_type AS "eventType"
       FROM venue_reviews
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function setReviewStatus(
  id: number,
  status: Exclude<ReviewStatus, "pending">,
): Promise<VenueReview | null> {
  const { rows } = await query<VenueReview>(
    `UPDATE venue_reviews SET status = $2 WHERE id = $1 AND status = 'pending'
     RETURNING ${REVIEW_COLUMNS}, reviewer_name AS "organizerName", event_type AS "eventType"`,
    [id, status],
  );
  return rows[0] ?? null;
}

export async function getReviewForBooking(bookingId: number): Promise<VenueReview | null> {
  const { rows } = await query<VenueReview>(
    `SELECT ${REVIEW_COLUMNS} FROM venue_reviews WHERE booking_id = $1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export interface ReviewSummary {
  count: number;
  averageRating: number | null;
  /** Tag → how many reviews mentioned it, most-mentioned first. */
  tagCounts: Array<[string, number]>;
}

/** Counted, never estimated — the host view shows these directly. */
export function summariseReviews(reviews: readonly VenueReview[]): ReviewSummary {
  if (reviews.length === 0) return { count: 0, averageRating: null, tagCounts: [] };
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const tag of review.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    count: reviews.length,
    averageRating: Math.round((total / reviews.length) * 10) / 10,
    tagCounts: [...counts.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export interface AspectScore {
  tag: string;
  /** How many reviewers picked this tag. */
  count: number;
  /** Share of all reviews that picked it, 0-100. */
  percent: number;
}

/**
 * Per-aspect signal (Wifi, Food, Clean, ...) for the venue page's score bars.
 *
 * There is no separate 1-5 rating per aspect in the data — a reviewer picks
 * tags for what stood out, on a scale with no negative pole (satisfied/good/
 * great). So a tag's count is read as "how many reviewers called this out",
 * not as "how good it is" — an aspect nobody has mentioned is "not rated yet",
 * never a bad score.
 */
export function aspectScores(reviews: readonly VenueReview[]): AspectScore[] {
  if (reviews.length === 0) return [];
  const { tagCounts } = summariseReviews(reviews);
  return tagCounts.map(([tag, count]) => ({
    tag,
    count,
    percent: Math.round((count / reviews.length) * 100),
  }));
}

import { query } from "@/lib/db";

export interface VenueBookingDraft {
  venueSlug: string;
  spaceId: string;
  formData: Record<string, unknown>;
  editedAtMs: number;
  submittedAtMs: number;
  updatedAt: Date;
}

export async function getVenueBookingDraft(userId: number, venueSlug: string): Promise<VenueBookingDraft | null> {
  const { rows } = await query<VenueBookingDraft>(
    `SELECT venue_slug AS "venueSlug", space_id AS "spaceId",
            form_data AS "formData", edited_at_ms::float8 AS "editedAtMs",
            submitted_at_ms::float8 AS "submittedAtMs", updated_at AS "updatedAt"
       FROM venue_booking_drafts WHERE user_id = $1 AND venue_slug = $2`,
    [userId, venueSlug],
  );
  return rows[0] ?? null;
}

export async function saveVenueBookingDraft(
  userId: number,
  venueSlug: string,
  spaceId: string,
  formData: Record<string, unknown>,
  editedAtMs: number,
): Promise<VenueBookingDraft | null> {
  const { rows } = await query<VenueBookingDraft>(
    `INSERT INTO venue_booking_drafts (user_id, venue_slug, space_id, form_data, edited_at_ms)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (user_id, venue_slug) DO UPDATE
       SET space_id = EXCLUDED.space_id,
           form_data = EXCLUDED.form_data,
           edited_at_ms = EXCLUDED.edited_at_ms,
           submitted_at_ms = 0,
           updated_at = now()
     WHERE venue_booking_drafts.edited_at_ms <= EXCLUDED.edited_at_ms
       AND venue_booking_drafts.submitted_at_ms < EXCLUDED.edited_at_ms
     RETURNING venue_slug AS "venueSlug", space_id AS "spaceId",
               form_data AS "formData", edited_at_ms::float8 AS "editedAtMs",
               submitted_at_ms::float8 AS "submittedAtMs", updated_at AS "updatedAt"`,
    [userId, venueSlug, spaceId, JSON.stringify(formData), editedAtMs],
  );
  return rows[0] ?? null;
}

export async function deleteVenueBookingDraft(userId: number, venueSlug: string, spaceId: string): Promise<void> {
  // A marker blocks a save that was already in flight when the booking was
  // submitted. The next deliberate edit has a later timestamp and can start
  // a fresh draft for the same venue.
  await query(
    `INSERT INTO venue_booking_drafts (user_id, venue_slug, space_id, form_data, submitted_at_ms)
     VALUES ($1, $2, $3, '{}'::jsonb, $4)
     ON CONFLICT (user_id, venue_slug) DO UPDATE
       SET form_data = '{}'::jsonb,
           edited_at_ms = 0,
           submitted_at_ms = GREATEST(venue_booking_drafts.submitted_at_ms, EXCLUDED.submitted_at_ms),
           updated_at = now()`,
    [userId, venueSlug, spaceId, Date.now()],
  );
}

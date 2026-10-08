-- Durable event outbox. Triggers participate in the booking/payment transaction;
-- nothing is backfilled and a rolled-back booking can never send a message.
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS cancellation_actor TEXT;
CREATE TABLE IF NOT EXISTS venue_notifications (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  booking_id INT REFERENCES venue_bookings(id),
  partner_request_id INT REFERENCES venue_partner_requests(id),
  venue_slug TEXT,
  audience TEXT NOT NULL CHECK (audience IN ('organiser','host','partner')),
  recipient TEXT NOT NULL CHECK (recipient ~ '^91[6-9][0-9]{9}$'),
  payload JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','delivered','read','failed','unknown','skipped')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  claim_token UUID,
  provider_message_id TEXT UNIQUE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venue_notifications_pending ON venue_notifications(next_attempt_at,id) WHERE state = 'pending';
ALTER TABLE venue_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON venue_notifications FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON venue_notifications FROM authenticated; END IF;
END $$;

CREATE OR REPLACE FUNCTION queue_venue_booking_notification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  event_kind TEXT;
  snapshot JSONB;
  phone TEXT;
  charge INT;
BEGIN
  IF NEW.archived_at IS NOT NULL OR NEW.venue_slug <> 'time-cafe' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'requested' THEN RETURN NEW; END IF;
    event_kind := 'requested';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','confirmed','declined','cancelled','expired') THEN
    event_kind := NEW.status;
  ELSIF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND NEW.status IN ('confirmed','checked_in','completed') THEN
    event_kind := 'confirmed';
  ELSIF NEW.status = 'checked_in' AND OLD.overrun_notified_at IS NULL AND NEW.overrun_notified_at IS NOT NULL THEN
    event_kind := 'overrun';
  ELSE RETURN NEW;
  END IF;
  charge := COALESCE(NEW.trial_amount_paise, ROUND(NEW.total * 100)::int);
  IF event_kind = 'confirmed' THEN
    SELECT amount_paise INTO charge FROM venue_booking_payments
      WHERE booking_id = NEW.id AND paid_at IS NOT NULL AND currency='INR' LIMIT 1;
    -- A status alone is not proof of payment.
    IF charge IS NULL OR NEW.paid_at IS NULL THEN RETURN NEW; END IF;
  END IF;
  snapshot := jsonb_build_object('name',NEW.organizer_name,'eventType',NEW.event_type,
    'venueName',NEW.venue_name,'spaceName',NEW.space_name,'date',NEW.event_date::text,
    'time',NEW.start_time::text,'people',NEW.people,'code',NEW.code,'amountPaise',charge,
    'actor',COALESCE(NEW.cancellation_actor,'the venue'));
  phone := regexp_replace(NEW.organizer_phone,'[^0-9]','','g');
  IF length(phone)=10 THEN phone := '91' || phone; END IF;
  IF NEW.whatsapp_opt_in AND phone ~ '^91[6-9][0-9]{9}$' THEN
    INSERT INTO venue_notifications(event_key,kind,booking_id,venue_slug,audience,recipient,payload)
      VALUES ('booking:'||NEW.id||':'||event_kind||':organiser',event_kind,NEW.id,NEW.venue_slug,'organiser',phone,snapshot)
      ON CONFLICT(event_key) DO NOTHING;
  END IF;
  IF event_kind IN ('requested','confirmed') THEN
    INSERT INTO venue_notifications(event_key,kind,booking_id,venue_slug,audience,recipient,payload)
      SELECT 'booking:'||NEW.id||':'||event_kind||':host:'||h.phone_e164,event_kind,NEW.id,NEW.venue_slug,'host',h.phone_e164,snapshot
      FROM venue_host_access h WHERE h.venue_slug=NEW.venue_slug AND h.revoked_at IS NULL
      ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS venue_booking_notification ON venue_bookings;
CREATE TRIGGER venue_booking_notification AFTER INSERT OR UPDATE OF status,paid_at,overrun_notified_at ON venue_bookings
  FOR EACH ROW EXECUTE FUNCTION queue_venue_booking_notification();

CREATE OR REPLACE FUNCTION queue_venue_partner_notification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE phone TEXT;
BEGIN
  phone := regexp_replace(NEW.phone,'[^0-9]','','g');
  IF length(phone)=10 THEN phone := '91' || phone; END IF;
  IF phone ~ '^91[6-9][0-9]{9}$' THEN
    INSERT INTO venue_notifications(event_key,kind,partner_request_id,audience,recipient,payload)
      VALUES ('partner:'||NEW.id,'listing_received',NEW.id,'partner',phone,
        jsonb_build_object('name',NEW.contact_name,'venueName',NEW.venue_name,'area',NEW.area))
      ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS venue_partner_notification ON venue_partner_requests;
CREATE TRIGGER venue_partner_notification AFTER INSERT ON venue_partner_requests
  FOR EACH ROW EXECUTE FUNCTION queue_venue_partner_notification();

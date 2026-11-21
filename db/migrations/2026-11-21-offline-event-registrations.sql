-- Host-collected tickets are real seats, not simulated gateway payments.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'razorpay';
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS offline_reference TEXT;
ALTER TABLE event_registrations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE event_registrations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE event_registrations ALTER COLUMN phone_e164 DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_registration_offline_reference
  ON event_registrations(event_id, offline_reference) WHERE offline_reference IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='event_registration_payment_source') THEN
    ALTER TABLE event_registrations ADD CONSTRAINT event_registration_payment_source CHECK (
      (payment_source='razorpay' AND user_id IS NOT NULL AND email IS NOT NULL
        AND phone_e164 IS NOT NULL AND offline_reference IS NULL)
      OR
      (payment_source='host_direct' AND user_id IS NULL AND order_id IS NULL AND payment_id IS NULL
        AND fee_paise IS NOT NULL AND fee_paise=0 AND paid_at IS NOT NULL AND NOT whatsapp_opt_in
        AND status IN ('confirmed','checked_in','cancelled')
        AND offline_reference IS NOT NULL AND length(offline_reference) BETWEEN 4 AND 120
        AND (phone_e164 IS NULL OR phone_e164 ~ '^91[6-9][0-9]{9}$'))
    );
  END IF;
END $$;
COMMIT;

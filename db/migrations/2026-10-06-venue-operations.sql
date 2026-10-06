BEGIN;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS trial_duration_minutes INT CHECK (trial_duration_minutes = 5);
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS trial_amount_paise INT CHECK (trial_amount_paise >= 100);
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS venue_booking_payments (
  order_id TEXT PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES venue_bookings(id),
  amount_paise INT NOT NULL CHECK (amount_paise >= 100),
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venue_booking_payments_booking ON venue_booking_payments(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_booking_single_open_payment ON venue_booking_payments(booking_id) WHERE paid_at IS NULL;
CREATE TABLE IF NOT EXISTS venue_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Menu',
  price_paise INT NOT NULL CHECK (price_paise >= 0),
  available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venue_menu_items_venue ON venue_menu_items(venue_slug, sort_order);
ALTER TABLE venue_booking_orders ADD COLUMN IF NOT EXISTS menu_item_id UUID;
ALTER TABLE venue_booking_orders ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0);
ALTER TABLE venue_booking_orders ADD COLUMN IF NOT EXISTS unit_price_paise INT;
ALTER TABLE venue_booking_orders ADD COLUMN IF NOT EXISTS request_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_order_request_key ON venue_booking_orders(booking_id, request_key) WHERE request_key IS NOT NULL;
ALTER TABLE venue_booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_booking_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON venue_booking_payments, venue_menu_items, venue_booking_orders FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON venue_booking_payments, venue_menu_items, venue_booking_orders FROM authenticated;
  END IF;
END $$;
-- Preserve historical rows, but only our onboarded partner is public.
UPDATE venues SET status = 'hidden' WHERE slug <> 'time-cafe' AND status <> 'hidden';
COMMIT;

-- On-site event ticketing is separate from venue reservations. No event is published here.
CREATE TABLE IF NOT EXISTS hosted_events (
  event_id INTEGER PRIMARY KEY REFERENCES events(id),
  host_name TEXT NOT NULL,
  host_person TEXT,
  price_paise INTEGER NOT NULL CHECK (price_paise BETWEEN 100 AND 10000000),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 10000),
  registration_state TEXT NOT NULL DEFAULT 'closed' CHECK (registration_state IN ('open','sold_out','closed')),
  description TEXT NOT NULL DEFAULT '',
  gallery JSONB NOT NULL DEFAULT '[]',
  quote JSONB,
  good_to_know JSONB NOT NULL DEFAULT '[]',
  refund_policy TEXT NOT NULL,
  terms JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_host_access (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^91[6-9][0-9]{9}$'),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 2 AND 120),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(event_id, phone_e164)
);
ALTER TABLE venue_user_sessions ADD COLUMN IF NOT EXISTS host_event_id INTEGER REFERENCES events(id);
CREATE INDEX IF NOT EXISTS event_host_access_phone ON event_host_access(phone_e164) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES hosted_events(event_id),
  user_id INTEGER NOT NULL REFERENCES venue_users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  registration_token TEXT NOT NULL UNIQUE,
  ticket_token TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','checked_in','cancelled','payment_review')),
  order_id TEXT UNIQUE,
  payment_id TEXT UNIQUE,
  fee_paise INTEGER,
  hold_until TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
  paid_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_registration_seats ON event_registrations(event_id, status, hold_until);
CREATE TABLE IF NOT EXISTS event_waitlist (
  event_id INTEGER NOT NULL REFERENCES hosted_events(event_id),
  user_id INTEGER NOT NULL REFERENCES venue_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS event_reminder_runs (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES hosted_events(event_id),
  template_key TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by INTEGER REFERENCES venue_users(id),
  UNIQUE(event_id, template_key)
);
CREATE TABLE IF NOT EXISTS event_notifications (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES event_registrations(id),
  reminder_run_id INTEGER REFERENCES event_reminder_runs(id),
  kind TEXT NOT NULL CHECK (kind IN ('ticket','day-before','morning-of','directions')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','delivered','read','failed','unknown','skipped')),
  claim_token TEXT,
  claimed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_message_id TEXT UNIQUE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(registration_id, kind)
);
CREATE INDEX IF NOT EXISTS event_notifications_pending ON event_notifications(next_attempt_at) WHERE state='pending';

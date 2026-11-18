-- Mail system schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Har bheji gayi mail ka record
CREATE TABLE IF NOT EXISTS emails (
  id              SERIAL PRIMARY KEY,
  resend_email_id TEXT UNIQUE,
  from_email      TEXT NOT NULL,
  to_emails       TEXT[] NOT NULL,
  cc_emails       TEXT[] NOT NULL DEFAULT '{}',
  bcc_emails      TEXT[] NOT NULL DEFAULT '{}',
  reply_to        TEXT,
  subject         TEXT NOT NULL,
  html_body       TEXT,
  text_body       TEXT,
  attachment_names TEXT[] NOT NULL DEFAULT '{}',
  -- queued -> sent -> delivered | bounced | complained | delayed | failed
  status          TEXT NOT NULL DEFAULT 'queued',
  error_message   TEXT,
  sent_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails (status);

-- Resend webhook se aaye events
CREATE TABLE IF NOT EXISTS email_events (
  id              SERIAL PRIMARY KEY,
  webhook_id      TEXT UNIQUE,            -- svix-id (duplicate event se bachne ke liye)
  resend_email_id TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_resend_email_id ON email_events (resend_email_id);

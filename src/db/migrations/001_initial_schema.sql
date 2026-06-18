-- Echo Ramp v1 — Phase 0 initial schema
-- Remaining tables from Database Design §4 added in later migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Integrators ─────────────────────────────────────────────────────────────

CREATE TYPE integrator_status AS ENUM ('active', 'suspended');

CREATE TABLE integrator_accounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255) NOT NULL,
  api_key_hash        VARCHAR(255) NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  revenue_share_bps   INTEGER NOT NULL DEFAULT 0,
  status              integrator_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integrator_status ON integrator_accounts (status);

-- ─── End users ───────────────────────────────────────────────────────────────

CREATE TYPE end_user_status AS ENUM ('active', 'blocked');

CREATE TABLE end_users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integrator_id       UUID NOT NULL REFERENCES integrator_accounts (id),
  integrator_user_id  VARCHAR(255) NOT NULL,
  status              end_user_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_end_user_integrator UNIQUE (integrator_id, integrator_user_id)
);

CREATE INDEX idx_end_user_integrator ON end_users (integrator_id);

-- ─── Sessions ────────────────────────────────────────────────────────────────

CREATE TYPE session_direction AS ENUM ('on_ramp', 'off_ramp', 'wallet_to_wallet');

CREATE TYPE session_state AS ENUM (
  'created',
  'kyc_required',
  'kyc_ok',
  'bank_link_required',
  'wallet_required',
  'quote_requested',
  'quote_ready',
  'order_pending',
  'order_filled',
  'completed',
  'failed',
  'cancelled'
);

CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integrator_id         UUID NOT NULL REFERENCES integrator_accounts (id),
  user_id               UUID NOT NULL REFERENCES end_users (id),
  direction             session_direction NOT NULL,
  source_asset          VARCHAR(10) NOT NULL,
  target_asset          VARCHAR(10) NOT NULL,
  amount_numeric        DECIMAL(30, 8),
  amount_currency       CHAR(3),
  state                 session_state NOT NULL DEFAULT 'created',
  corridor              VARCHAR(2) NOT NULL,
  metadata              JSONB NOT NULL DEFAULT '{}',
  idempotency_key       UUID NOT NULL,
  client_token_version  INTEGER NOT NULL DEFAULT 1,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_session_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_sessions_integrator_state ON sessions (integrator_id, state);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- ─── Idempotency ─────────────────────────────────────────────────────────────

CREATE TABLE idempotency_keys (
  key               UUID PRIMARY KEY,
  method            VARCHAR(10) NOT NULL,
  path              VARCHAR(255) NOT NULL,
  response_status   INTEGER NOT NULL,
  response_body     JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);

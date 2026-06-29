-- Echo Ramp v1.2 — Lydiam/BCB programme schema

-- Extend session_state for compliance handoff and named account flows
ALTER TYPE session_state ADD VALUE IF NOT EXISTS 'compliance_handoff_pending';
ALTER TYPE session_state ADD VALUE IF NOT EXISTS 'compliance_handoff_ok';
ALTER TYPE session_state ADD VALUE IF NOT EXISTS 'named_account_pending';
ALTER TYPE session_state ADD VALUE IF NOT EXISTS 'compliance_pending';

-- ─── Sumsub KYC profiles ───────────────────────────────────────────────────────

CREATE TYPE kyc_level AS ENUM ('basic', 'advanced');
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE sumsub_kyc_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES end_users (id),
  sumsub_applicant_id   VARCHAR(255) NOT NULL,
  level                 kyc_level NOT NULL DEFAULT 'basic',
  status                kyc_status NOT NULL DEFAULT 'pending',
  raw_snapshot          JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sumsub_user UNIQUE (user_id)
);

CREATE INDEX idx_sumsub_applicant ON sumsub_kyc_profiles (sumsub_applicant_id);

-- ─── Compliance packs and submissions ──────────────────────────────────────────

CREATE TYPE compliance_submission_status AS ENUM ('pending', 'approved', 'rejected', 'review');

CREATE TABLE compliance_packs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES end_users (id),
  pack        JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_packs_user ON compliance_packs (user_id);

CREATE TABLE compliance_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pack_id       UUID NOT NULL REFERENCES compliance_packs (id),
  user_id       UUID NOT NULL REFERENCES end_users (id),
  partner       VARCHAR(50) NOT NULL DEFAULT 'lydiam',
  external_ref  VARCHAR(255),
  status        compliance_submission_status NOT NULL DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_compliance_submissions_user ON compliance_submissions (user_id);
CREATE INDEX idx_compliance_submissions_status ON compliance_submissions (status);

-- ─── Named fiat accounts (BCB virtual accounts) ──────────────────────────────

CREATE TYPE named_account_status AS ENUM ('pending', 'active', 'closed');

CREATE TABLE user_named_fiat_accounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES end_users (id),
  account_identifier  VARCHAR(64) NOT NULL DEFAULT '',
  currency            CHAR(3) NOT NULL,
  provider            VARCHAR(50) NOT NULL DEFAULT 'bcb',
  bcb_correlation_id  VARCHAR(255) NOT NULL,
  status              named_account_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_named_accounts_user ON user_named_fiat_accounts (user_id);
CREATE INDEX idx_named_accounts_iban ON user_named_fiat_accounts (account_identifier);

-- ─── User wallets (no Echo screening) ────────────────────────────────────────

CREATE TABLE user_wallets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES end_users (id),
  address     VARCHAR(255) NOT NULL,
  chain       VARCHAR(50) NOT NULL,
  asset       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_wallet UNIQUE (user_id, address, chain)
);

CREATE INDEX idx_user_wallets_user ON user_wallets (user_id);

-- ─── Quotes ──────────────────────────────────────────────────────────────────

CREATE TYPE quote_status AS ENUM ('pending', 'ready', 'accepted', 'expired', 'rejected');

CREATE TABLE quotes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID NOT NULL REFERENCES sessions (id),
  provider_quote_id   VARCHAR(255),
  routing_provider    VARCHAR(50) NOT NULL DEFAULT 'lydiam',
  pair                VARCHAR(20) NOT NULL,
  direction           session_direction NOT NULL,
  desk_rate           DECIMAL(20, 8) NOT NULL,
  fee_echo_bps        INTEGER NOT NULL DEFAULT 0,
  fee_integrator_bps  INTEGER NOT NULL DEFAULT 0,
  total_rate          DECIMAL(20, 8) NOT NULL,
  fiat_amount         DECIMAL(30, 8) NOT NULL,
  crypto_amount       DECIMAL(30, 8) NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  status              quote_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_session ON quotes (session_id);
CREATE INDEX idx_quotes_status ON quotes (session_id, status);

-- ─── Orders ──────────────────────────────────────────────────────────────────

CREATE TYPE order_status AS ENUM (
  'pending_submission',
  'submitted',
  'compliance_pending',
  'partially_filled',
  'filled',
  'failed',
  'settled',
  'cancelled'
);

CREATE TYPE compliance_checkpoint_status AS ENUM ('pending', 'cleared', 'rejected');

CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id                  UUID NOT NULL REFERENCES sessions (id),
  quote_id                    UUID REFERENCES quotes (id),
  provider_order_id           VARCHAR(255),
  direction                   session_direction NOT NULL,
  fiat_amount                 DECIMAL(30, 8) NOT NULL,
  crypto_amount               DECIMAL(30, 8) NOT NULL,
  user_wallet_id              UUID REFERENCES user_wallets (id),
  routing_provider            VARCHAR(50) NOT NULL DEFAULT 'lydiam',
  compliance_status           compliance_checkpoint_status,
  programme_deposit_address   VARCHAR(255),
  status                      order_status NOT NULL DEFAULT 'pending_submission',
  tx_hash                     VARCHAR(255),
  filled_at                   TIMESTAMPTZ,
  settled_at                  TIMESTAMPTZ,
  failure_reason              TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_session ON orders (session_id);
CREATE INDEX idx_orders_provider ON orders (provider_order_id);

-- ─── Webhook inbox ───────────────────────────────────────────────────────────

CREATE TABLE webhook_inbox (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source              VARCHAR(50) NOT NULL,
  payload             JSONB NOT NULL,
  signature_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_inbox_source ON webhook_inbox (source, processed_at);

-- ─── Ledger events ─────────────────────────────────────────────────────────────

CREATE TYPE ledger_event_type AS ENUM (
  'fiat_deposit',
  'fiat_withdrawal',
  'crypto_deposit',
  'crypto_withdrawal',
  'off_ramp',
  'on_ramp',
  'fee',
  'state_change'
);

CREATE TABLE ledger_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES sessions (id),
  event_type    ledger_event_type NOT NULL,
  asset         VARCHAR(10) NOT NULL,
  amount        DECIMAL(30, 8) NOT NULL,
  counterparty  VARCHAR(255) NOT NULL DEFAULT '',
  reference_id  VARCHAR(255),
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_session ON ledger_events (session_id);

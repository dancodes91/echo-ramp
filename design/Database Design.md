# Echo Ramp v1 — Database Design


**Version:** 1.2  
**Date:** 2026-06-18  


---


## 1. Overview


The database is the authoritative store for all orchestration state. It is **non‑custodial** — no balances are held, no private keys are stored. Every state mutation, compliance decision, and value movement is immutably recorded in the ledger.


This design matches the **Echo Ramp System Design** (non‑custodial, quote‑order‑ledger pattern) and the **Integrator API Specification** (Server + Client APIs, sessions, quotes, orders, transfers, webhooks).


---


## 2. Technology & Configuration


| Aspect | Choice |
|--------|--------|
| **DBMS** | PostgreSQL 15+ (managed, e.g., AWS RDS, Cloud SQL) |
| **Replicas** | At least one read‑replica for query‑heavy services |
| **Caching** | Redis for hot data (active quotes, session states); not part of this schema |
| **Encryption** | Column‑level encryption for PII/sensitive data using `pgcrypto` + KMS‑wrapped keys |
| **Extras** | `uuid-ossp` extension for UUID generation, `pg_stat_statements` for query analysis |


---


## 3. Design Principles


1. **UUIDs as primary keys** — avoids enumeration and simplifies distributed generation.
2. **Append-only ledger** — financial events are never mutated or deleted.
3. **All monetary values are `DECIMAL(30,8)`** — exact precision for fiat and crypto.
4. **All amounts stored as strings in API, but as numeric in DB** (validated, no floating-point).
5. **Encryption at rest** — addresses, tokens, secrets are stored encrypted; PII can be hashed where only lookup is needed.
6. **Status enums** — strictly defined per resource, with allowed transitions enforced in application layer.
7. **Idempotency** — enforced via a dedicated table, guaranteeing exactly-once semantics.
8. **Audit trail** — sensitive data access and admin actions are logged separately.
9. **Soft deletes are avoided** — state is definitive; historical records remain (except user-requested PII deletion for compliance).
10. **Indexes support API queries** — every `GET` endpoint has a covering index.
11. **User-initiated outbound** — every bank payout is tied to a `user_payment_authorisations` record; Echo never sweeps or maintains standing mandate over user accounts.


---


## 4. Schema Definitions


### 4.1 `integrator_accounts`


| Column                 | Type                     | Description                                      |
|------------------------|--------------------------|--------------------------------------------------|
| `id`                   | `UUID PK`                |                                                  |
| `name`                 | `VARCHAR(255)`           | Display name                                     |
| `api_key_hash`         | `VARCHAR(255)`           | Bcrypt hash of API key                           |
| `api_secret_encrypted` | `TEXT`                   | Encrypted HMAC secret (envelope encryption)      |
| `revenue_share_bps`    | `INTEGER`                | Default revenue share in basis points            |
| `status`               | `ENUM('active','suspended')` |                                              |
| `created_at`           | `TIMESTAMPTZ`            |                                                  |
| `updated_at`           | `TIMESTAMPTZ`            |                                                  |


**Indexes:** `idx_integrator_status` on (`status`) for admin filtering.


---


### 4.2 `end_users`


| Column                | Type                     | Description                                      |
|-----------------------|--------------------------|--------------------------------------------------|
| `id`                  | `UUID PK`                |                                                  |
| `integrator_id`       | `UUID FK` → `integrator_accounts.id` |                              |
| `integrator_user_id`  | `VARCHAR(255)`           | Opaque user reference from integrator            |
| `status`              | `ENUM('active','blocked')` |                                                |
| `created_at`          | `TIMESTAMPTZ`            |                                                  |
| `updated_at`          | `TIMESTAMPTZ`            |                                                  |


**Unique constraint:** `uq_end_user_integrator` on (`integrator_id`, `integrator_user_id`) — ensures one Echo user per integrator customer.


**Indexes:** `idx_end_user_integrator` on (`integrator_id`) for listing all users of an integrator.


---


### 4.3 `user_kyc`


Stores the current KYC state for a user. Each user has exactly one active KYC record (can be replaced for re‑verification).


| Column                  | Type                     | Description                                      |
|-------------------------|--------------------------|--------------------------------------------------|
| `id`                    | `UUID PK`                |                                                  |
| `user_id`               | `UUID FK` → `end_users.id` UNIQUE |                                         |
| `sumsub_applicant_id`   | `VARCHAR(255)`           | External applicant ID                            |
| `level`                 | `ENUM('basic','advanced')` | KYC tier                                      |
| `status`                | `ENUM('pending','approved','rejected')` |                                    |
| `rejection_reason`      | `TEXT`                   | If rejected                                      |
| `document_type`         | `VARCHAR(50)`            | e.g., `passport`, `drivers_license`              |
| `raw_result`            | `JSONB`                  | Full Sumsub response (encrypted)                 |
| `expires_at`            | `TIMESTAMPTZ`            | KYC validity expiry (regulatory)                 |
| `created_at`            | `TIMESTAMPTZ`            |                                                  |
| `updated_at`            | `TIMESTAMPTZ`            |                                                  |


**Encryption:** `raw_result` is encrypted at rest (may contain PII).


**Index:** `idx_kyc_sumsub` on (`sumsub_applicant_id`) for webhook lookups.


---


### 4.4 `user_wallets`


Stores RLUSD wallet addresses provided by users. All addresses are screened via Lydiam/BCB (via programme routing) before use.


| Column              | Type                     | Description                                      |
|---------------------|--------------------------|--------------------------------------------------|
| `id`                | `UUID PK`                |                                                  |
| `user_id`           | `UUID FK` → `end_users.id` |                                                |
| `address`           | `TEXT`                   | **Encrypted** RLUSD wallet address               |
| `address_hash`      | `VARCHAR(64)`            | SHA‑256 hash of address for lookup without decryption |
| `chain`             | `VARCHAR(10)`            | Default `'XRPL'`                                 |
| `tag`               | `VARCHAR(20)`            | Destination tag (optional)                       |
| `label`             | `VARCHAR(100)`           | User‑friendly label                              |
| `compliance_status`  | `ENUM('pending','approved','rejected')` | Lydiam/BCB (via programme routing) result           |
| `screened_at`       | `TIMESTAMPTZ`            |                                                  |
| `created_at`        | `TIMESTAMPTZ`            |                                                  |
| `updated_at`        | `TIMESTAMPTZ`            |                                                  |


**Unique constraint:** `uq_wallet_address_per_user_chain` on (`user_id`, `address_hash`, `chain`) — prevents duplicate registrations.


**Indexes:** `idx_wallet_screening` on (`compliance_status`) for compliance queue.


**Encryption:** `address` is encrypted using `pgcrypto` with a KMS‑backed key; `address_hash` enables lookups without decryption.


---


### 4.5 `user_bank_links`


Represents a linked bank account via an aggregator (Plaid, TrueLayer, etc.).


| Column                    | Type                     | Description                                      |
|---------------------------|--------------------------|--------------------------------------------------|
| `id`                      | `UUID PK`                |                                                  |
| `user_id`                 | `UUID FK` → `end_users.id` |                                                |
| `provider`                | `ENUM('plaid_us','truelayer_uk','tink_eu','volt_uk')` |                                |
| `provider_token_encrypted`| `TEXT`                   | Encrypted access token from aggregator           |
| `masked_account_number`   | `VARCHAR(20)`            | e.g., `****1234`                                 |
| `institution_name`        | `VARCHAR(100)`           |                                                  |
| `status`                  | `ENUM('linked','unlinked')` |                                              |
| `linked_at`               | `TIMESTAMPTZ`            |                                                  |
| `created_at`              | `TIMESTAMPTZ`            |                                                  |
| `updated_at`              | `TIMESTAMPTZ`            |                                                  |


**Indexes:** `idx_bank_links_user` on (`user_id`, `status`) for fetching active links.


---


### 4.6 `user_named_fiat_accounts`


Virtual fiat accounts (vIBAN‑style) provisioned on Ripple fiat rails.


| Column                | Type                     | Description                                      |
|-----------------------|--------------------------|--------------------------------------------------|
| `id`                  | `UUID PK`                |                                                  |
| `user_id`             | `UUID FK` → `end_users.id` |                                                |
| `provider`            | `VARCHAR(50)`            | `'bcb'` (primary); `'palisade'` if fallback active |
| `account_identifier`  | `VARCHAR(100)`           | vIBAN or similar unique identifier               |
| `currency`            | `CHAR(3)`                | `'USD'`, `'EUR'`, `'GBP'`                        |
| `status`              | `ENUM('active','closed')` |                                                  |
| `provisioned_at`      | `TIMESTAMPTZ`            |                                                  |
| `created_at`          | `TIMESTAMPTZ`            |                                                  |
| `updated_at`          | `TIMESTAMPTZ`            |                                                  |


**Unique constraint:** `uq_named_account` on (`user_id`, `currency`, `provider`) — one per currency per provider.


---


### 4.7 `sessions`


Core orchestrator for a conversion flow. One session per conversion attempt (on‑ramp, off‑ramp, wallet‑to‑wallet). Ties together all resources.


| Column                | Type                     | Description                                      |
|-----------------------|--------------------------|--------------------------------------------------|
| `id`                  | `UUID PK`                |                                                  |
| `integrator_id`       | `UUID FK` → `integrator_accounts.id` |                                      |
| `user_id`             | `UUID FK` → `end_users.id` |                                                |
| `direction`           | `ENUM('on_ramp','off_ramp','wallet_to_wallet')` |                          |
| `source_asset`        | `VARCHAR(10)`            | `'USD'`, `'RLUSD'`, etc.                          |
| `target_asset`        | `VARCHAR(10)`            |                                                   |
| `amount_numeric`      | `DECIMAL(30,8)`          | Fiat side amount (if direction involves fiat)    |
| `amount_currency`     | `CHAR(3)`                | Currency of amount (e.g., `'USD'`)               |
| `state`               | `ENUM(...)`              | See state machine below                          |
| `corridor`            | `VARCHAR(2)`             | ISO country code (`'US'`, `'GB'`, etc.)          |
| `metadata`            | `JSONB`                  | Integrator‑supplied opaque data                  |
| `idempotency_key`     | `UUID`                   | Unique per session creation                      |
| `client_token_version`| `INTEGER`                | Incremented when token refreshed                 |
| `expires_at`          | `TIMESTAMPTZ`            | Session timeout after inactivity                 |
| `created_at`          | `TIMESTAMPTZ`            |                                                  |
| `updated_at`          | `TIMESTAMPTZ`            |                                                  |


**State enum values:**  
`'created'`, `'kyc_required'`, `'kyc_ok'`, `'bank_link_required'`, `'wallet_required'`, `'quote_requested'`, `'quote_ready'`, `'order_pending'`, `'order_filled'`, `'completed'`, `'failed'`, `'cancelled'`


**Indexes:**
- `idx_sessions_integrator_state` on (`integrator_id`, `state`) — partner dashboard.
- `idx_sessions_user` on (`user_id`).
- `uq_session_idempotency` unique on (`idempotency_key`) — ensures exactly‑once creation.


---


### 4.8 `quotes`


A quote is always tied to a session. Only one active quote can exist per session; old quotes are expired.


| Column                 | Type                     | Description                                      |
|------------------------|--------------------------|--------------------------------------------------|
| `id`                   | `UUID PK`                |                                                  |
| `session_id`           | `UUID FK` → `sessions.id` |                                                 |
| `desk_quote_id`        | `VARCHAR(255)`           | ID returned by OTC desk                          |
| `pair`                 | `VARCHAR(10)`            | `'USD/RLUSD'` etc.                                |
| `direction`            | `ENUM('on_ramp','off_ramp')` |                                               |
| `desk_rate`            | `DECIMAL(20,10)`         | Rate from desk (fiat per RLUSD)                  |
| `fee_echo_bps`         | `INTEGER`                | Echo fee in basis points                         |
| `fee_integrator_bps`   | `INTEGER`                | Integrator revenue share in bps                  |
| `total_rate`           | `DECIMAL(20,10)`         | Effective rate after fees                        |
| `fiat_amount`          | `DECIMAL(30,8)`          | Input/output fiat amount                         |
| `crypto_amount`        | `DECIMAL(30,8)`          | Computed RLUSD amount                            |
| `expires_at`           | `TIMESTAMPTZ`            | Quote validity deadline                          |
| `status`               | `ENUM('pending','ready','accepted','expired','rejected')` |                  |
| `created_at`           | `TIMESTAMPTZ`            |                                                  |
| `updated_at`           | `TIMESTAMPTZ`            |                                                  |


**Indexes:** `idx_quotes_session_status` on (`session_id`, `status`), `idx_quotes_desk` on (`desk_quote_id`).


---


### 4.9 `orders`


Created when a quote is accepted. Represents an OTC desk order.


| Column                  | Type                     | Description                                      |
|-------------------------|--------------------------|--------------------------------------------------|
| `id`                    | `UUID PK`                |                                                  |
| `session_id`            | `UUID FK` → `sessions.id` |                                                 |
| `quote_id`              | `UUID FK` → `quotes.id` (nullable, may be direct) |                              |
| `desk_order_id`         | `VARCHAR(255)`           | ID from OTC desk                                 |
| `direction`             | `ENUM('on_ramp','off_ramp')` |                                              |
| `fiat_amount`           | `DECIMAL(30,8)`          |                                                  |
| `crypto_amount`         | `DECIMAL(30,8)`          |                                                  |
| `user_wallet_id`        | `UUID FK` → `user_wallets.id` | For on‑ramp: destination; off‑ramp: source  |
| `routing_provider`      | `VARCHAR(50)`            | Which provider executed the order: `'bcb'`, `'ripple_otc'`, `'openfx'`, `'palisade'` |
| `provider_deposit_address` | `TEXT`                | For off-ramp: counterparty address where user sends stablecoin from their own wallet (encrypted) |
| `status`                | `ENUM('pending_submission','submitted','partially_filled','filled','failed','settled','cancelled')` | |
| `tx_hash`               | `VARCHAR(255)`           | On‑chain RLUSD transaction hash (off‑ramp)       |
| `filled_at`             | `TIMESTAMPTZ`            |                                                  |
| `settled_at`            | `TIMESTAMPTZ`            |                                                  |
| `failure_reason`        | `TEXT`                   | If failed                                        |
| `created_at`            | `TIMESTAMPTZ`            |                                                  |
| `updated_at`            | `TIMESTAMPTZ`            |                                                  |


**Indexes:** `idx_orders_desk` on (`desk_order_id`), `idx_orders_session` on (`session_id`), `idx_orders_status` on (`status`) for reconciliation.


---


### 4.10 `transfers`


Models RLUSD wallet‑to‑wallet movements (no fiat conversion).


| Column                  | Type                     | Description                                      |
|-------------------------|--------------------------|--------------------------------------------------|
| `id`                    | `UUID PK`                |                                                  |
| `session_id`            | `UUID FK` → `sessions.id` |                                                 |
| `source_wallet_id`      | `UUID FK` → `user_wallets.id` |                                            |
| `destination_wallet_id` | `UUID FK` → `user_wallets.id` |                                            |
| `amount`                | `DECIMAL(30,8)`          | RLUSD amount                                     |
| `status`                | `ENUM('screening_pending','screening_passed','screening_rejected','tx_broadcast','completed','failed')` | |
| `tx_hash`               | `VARCHAR(255)`           | On‑chain TX                                      |
| `screening_source`      | `ENUM('approved','rejected')` |                                                |
| `screening_destination` | `ENUM('approved','rejected')` |                                                |
| `created_at`            | `TIMESTAMPTZ`            |                                                  |
| `updated_at`            | `TIMESTAMPTZ`            |                                                  |


**Indexes:** `idx_transfers_session` on (`session_id`).


---


### 4.11 `user_payment_authorisations`


Records every user-authenticated bank payout session. Required to prove that every outbound bank movement was initiated under the user's own authentication, not Echo's. No standing mandate or sweep authority in Echo's favour.


| Column                 | Type                     | Description                                      |
|------------------------|--------------------------|--------------------------------------------------|
| `id`                   | `UUID PK`                |                                                  |
| `order_id`             | `UUID FK` → `orders.id`  | The off-ramp order this payout belongs to        |
| `user_id`              | `UUID FK` → `end_users.id` |                                                |
| `bank_link_id`         | `UUID FK` → `user_bank_links.id` |                                          |
| `provider`             | `VARCHAR(50)`            | `'plaid_us'`, `'truelayer_uk'`, `'tink_eu'`, `'volt_uk'` |
| `payment_intent_id`    | `VARCHAR(255)`           | Provider-side payment session / intent ID        |
| `amount`               | `DECIMAL(30,8)`          | Amount authorised by user                        |
| `currency`             | `CHAR(3)`                | Fiat currency                                    |
| `status`               | `ENUM('initiated','authorised','completed','failed')` |                          |
| `authorised_at`        | `TIMESTAMPTZ`            | When user completed the auth step in aggregator  |
| `created_at`           | `TIMESTAMPTZ`            |                                                  |
| `updated_at`           | `TIMESTAMPTZ`            |                                                  |


**Indexes:** `idx_payment_auth_order` on (`order_id`), `idx_payment_auth_user` on (`user_id`, `created_at`).


**Invariant:** An order cannot move to `completed` without an associated `user_payment_authorisations` record with `status = 'completed'`. Enforced at the service layer.


---


### 4.12 `ledger_events`


Immutable, append‑only record of every value movement and fee earnings. This is the source of truth for reconciliation.


| Column           | Type                     | Description                                      |
|------------------|--------------------------|--------------------------------------------------|
| `id`             | `BIGSERIAL PK`           | Append‑only order                                |
| `event_type`     | `ENUM('ON_RAMP','OFF_RAMP','INTERNAL_TRANSFER','STABLECOIN_EXCHANGE','FEE_EARNED','REVENUE_SHARE')` | |
| `session_id`     | `UUID`                   | Ref to session (nullable for system events)      |
| `order_id`       | `UUID`                   | Ref if tied to an order                          |
| `transfer_id`    | `UUID`                   | Ref if tied to a transfer                        |
| `user_id`        | `UUID`                   |                                                  |
| `integrator_id`  | `UUID`                   |                                                  |
| `direction`      | `VARCHAR(10)`            | `'in'` / `'out'`                                 |
| `fiat_amount`    | `DECIMAL(30,8)`          |                                                  |
| `fiat_currency`  | `CHAR(3)`                |                                                  |
| `crypto_amount`  | `DECIMAL(30,8)`          |                                                  |
| `crypto_asset`   | `VARCHAR(10)`            | `'RLUSD'`                                        |
| `rate`           | `DECIMAL(20,10)`         | Effective rate used                              |
| `fee_echo`       | `DECIMAL(30,8)`          |                                                  |
| `fee_integrator` | `DECIMAL(30,8)`          | Revenue share                                    |
| `counterparty`   | `VARCHAR(100)`           | `'routing_partner'`, user wallet addr hash, etc. — set per routing decision |
| `tx_hash`        | `VARCHAR(255)`           | On‑chain TX if applicable                        |
| `status`         | `VARCHAR(20)`            | `'completed'` / `'failed'`                       |
| `metadata`       | `JSONB`                  | Additional details                               |
| `created_at`     | `TIMESTAMPTZ`            |                                                  |


**No updates or deletes.** Application must never modify this table.  
**Indexes:** `idx_ledger_session` on (`session_id`), `idx_ledger_user` on (`user_id`, `created_at`), `idx_ledger_integrator` on (`integrator_id`, `created_at`) for reporting.


---


### 4.13 `webhook_subscriptions`


| Column               | Type                     | Description                                      |
|----------------------|--------------------------|--------------------------------------------------|
| `id`                 | `UUID PK`                |                                                  |
| `integrator_id`      | `UUID FK` → `integrator_accounts.id` |                                      |
| `url`                | `TEXT`                   | Endpoint URL                                     |
| `events`             | `TEXT[]`                 | Array of event types                             |
| `secret_encrypted`   | `TEXT`                   | HMAC secret for signing (encrypted)              |
| `enabled`            | `BOOLEAN`                |                                                  |
| `created_at`         | `TIMESTAMPTZ`            |                                                  |
| `updated_at`         | `TIMESTAMPTZ`            |                                                  |


**Index:** `idx_webhook_subs_integrator` on (`integrator_id`).


---


### 4.14 `webhook_deliveries`


| Column             | Type                     | Description                                      |
|--------------------|--------------------------|--------------------------------------------------|
| `id`               | `UUID PK`                |                                                  |
| `subscription_id`  | `UUID FK` → `webhook_subscriptions.id` |                                    |
| `event_type`       | `VARCHAR(50)`            |                                                  |
| `payload`          | `JSONB`                  | Full webhook body sent                           |
| `status`           | `ENUM('pending','delivered','failed')` |                                    |
| `attempts`         | `INTEGER`                |                                                  |
| `last_attempt_at`  | `TIMESTAMPTZ`            |                                                  |
| `response_code`    | `INTEGER`                | HTTP status from partner                         |
| `response_body`    | `TEXT`                   |                                                  |
| `created_at`       | `TIMESTAMPTZ`            |                                                  |


**Index:** `idx_webhook_deliveries_sub_status` on (`subscription_id`, `status`, `created_at`) for retry queries.


---


### 4.15 `idempotency_keys`


Enforces exactly‑once processing for all mutating endpoints.


| Column            | Type                     | Description                                      |
|-------------------|--------------------------|--------------------------------------------------|
| `key`             | `UUID PK`                | The idempotency key                              |
| `method`          | `VARCHAR(10)`            | HTTP method                                      |
| `path`            | `VARCHAR(255)`           | Normalised API path                              |
| `response_status` | `INTEGER`                | Cached HTTP status                               |
| `response_body`   | `JSONB`                  | Cached response                                  |
| `created_at`      | `TIMESTAMPTZ`            |                                                  |
| `expires_at`      | `TIMESTAMPTZ`            | Typically 24h after creation                     |


**Partitioning:** Could be partitioned by `created_at` for expiry cleanup.


---


### 4.16 `audit_logs`


| Column           | Type                     | Description                                      |
|------------------|--------------------------|--------------------------------------------------|
| `id`             | `BIGSERIAL PK`           |                                                  |
| `actor_type`     | `VARCHAR(20)`            | `'system'`, `'admin'`, `'integrator'`            |
| `actor_id`       | `UUID`                   |                                                  |
| `action`         | `VARCHAR(100)`           | e.g., `'wallet.screened'`, `'kyc.approved'`      |
| `resource_type`  | `VARCHAR(50)`            |                                                  |
| `resource_id`    | `UUID`                   |                                                  |
| `changes`        | `JSONB`                  | Diff of changed fields (redacted PII)            |
| `ip_address`     | `INET`                   |                                                  |
| `created_at`     | `TIMESTAMPTZ`            |                                                  |


**Index:** `idx_audit_resource` on (`resource_type`, `resource_id`), `idx_audit_actor` on (`actor_id`, `created_at`).


---


### 4.17 `sandbox_state` (per integrator)


For sandbox environment only; used for reset simulations.


| Column          | Type                     | Description                                      |
|-----------------|--------------------------|--------------------------------------------------|
| `integrator_id` | `UUID PK`                | FK to `integrator_accounts`                      |
| `reset_at`      | `TIMESTAMPTZ`            | Last simulated reset                             |
| `settings`      | `JSONB`                  | e.g., simulated delays, failure modes            |


---


## 5. Encryption Strategy


- **Column encryption:** `pgcrypto` with `PGP_SYM_ENCRYPT` / `PGP_SYM_DECRYPT` using a key stored in HashiCorp Vault (rotated every 90 days). The key itself is never stored in the DB.
- **Encrypted columns:**
  - `user_wallets.address`
  - `user_bank_links.provider_token_encrypted`
  - `user_kyc.raw_result` (contains PII)
  - `webhook_subscriptions.secret_encrypted`
  - `orders.provider_deposit_address`
- **Address hashing:** `user_wallets.address_hash = SHA256(address)` — enables lookup and unique constraints without decryption.
- **API keys/secrets:** Bcrypt for API key hash; envelope encryption for the HMAC secret.


---


## 6. State Machine Enforcement


Application code enforces allowed state transitions. Example for sessions:


```
created → kyc_required → kyc_ok → (bank_link_required | wallet_required) → ... → quote_ready → order_pending → order_filled → completed
```


The database only stores the current state; invalid transitions are rejected by the service layer.


---


## 7. Indexes & Performance


### Critical query patterns and their indexes:


| Query | Index |
|-------|-------|
| Get session by idempotency key | `uq_session_idempotency` |
| List integrator’s active sessions | `idx_sessions_integrator_state` |
| Find user by integrator_user_id | `uq_end_user_integrator` |
| Get active quote for session | `idx_quotes_session_status` |
| Fetch pending webhook deliveries | `idx_webhook_deliveries_sub_status` |
| Ledger by integrator and date range | `idx_ledger_integrator` + `created_at` |


### Partitioning:
- `ledger_events` and `audit_logs` should be range‑partitioned by `created_at` (monthly) for retention and performance.


---


## 8. Data Lifecycle


- **Sessions:** Marked `completed`, `failed`, or `cancelled`; soft state is irrelevant after 90 days. Can be archived.
- **KYC data:** Retained per regulatory requirements (e.g., 5 years after last transaction). Anonymized after that.
- **Ledger events:** Immutable; kept for the lifetime of the platform (audit).
- **Webhook deliveries:** Retained for 30 days; then pruned.
- **Idempotency keys:** Auto‑expired after 24h (cleanup job).


---


## 9. Example Queries


### Get full session state for Widget Client API
```sql
SELECT s.state, s.direction,
       k.status AS kyc_status,
       w.id AS wallet_id, w.compliance_status,
       b.id AS bank_id, b.masked_account_number,
       n.id AS named_account_id
FROM sessions s
LEFT JOIN user_kyc k ON k.user_id = s.user_id
LEFT JOIN user_wallets w ON w.user_id = s.user_id AND w.compliance_status = 'approved'
LEFT JOIN user_bank_links b ON b.user_id = s.user_id AND b.status = 'linked'
LEFT JOIN user_named_fiat_accounts n ON n.user_id = s.user_id AND n.status = 'active'
WHERE s.id = $1;
```


### Accept quote and create order (transaction)
```sql
BEGIN;
-- Validate quote is ready and not expired
SELECT id FROM quotes WHERE id = $1 AND status = 'ready' AND expires_at > now() FOR UPDATE;
-- Update quote to accepted
UPDATE quotes SET status = 'accepted', updated_at = now() WHERE id = $1;
-- Create order
INSERT INTO orders (session_id, quote_id, direction, ...) VALUES (...) RETURNING *;
COMMIT;
```


---


## 10. Alignment with API Endpoints


| API Resource | Primary Table(s) |
|--------------|------------------|
| `POST /server/sessions` | `sessions`, `end_users` (lookup) |
| `GET /server/sessions/{id}` | `sessions` + joined KYC, wallets, bank, named accounts |
| `POST /server/users/lookup` | `end_users` |
| `POST /server/webhooks` | `webhook_subscriptions` |
| `POST /client/kyc` | `user_kyc` |
| `GET /client/wallets` | `user_wallets` |
| `POST /client/wallets` | `user_wallets` |
| `POST /client/bank/links` | `user_bank_links` |
| `GET /client/named_accounts` | `user_named_fiat_accounts` |
| `POST /client/quotes` | `quotes` |
| `POST /client/quotes/{id}/accept` | `orders`, `quotes` (status update) |
| `POST /client/orders/{id}/confirm-send` | `orders` |
| `POST /client/orders/{id}/bank-payout` | `user_payment_authorisations`, `orders` |
| `POST /client/transfers` | `transfers` |
| `GET /server/orders/{id}` | `orders` |


---


## 11. Migration & Versioning


- Database migrations are managed with a tool like **Flyway** or **goose**.
- All schema changes are additive and backwards‑compatible within a major version.
- Breaking changes (column removal, type changes) go through a deprecation cycle in the API first.
- The `metadata` JSONB columns allow extension without schema changes.


---
# Echo Ramp v1.2

Non-custodial on/off-ramp orchestration API for the Echo Ramp embeddable widget.

Echo coordinates licensed third-party providers (Lydiam programme, BCB fiat rails, Plaid, Sumsub) but never holds user funds. All outbound bank and crypto movements are user-authenticated. Compliance screening and Travel Rule are handled by Lydiam — Echo submits KYC packs and routes all ramp activity via the programme.

## Stack

- **Runtime:** Node.js 20+, TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL 16
- **Cache / queue:** Redis (stub)

## Quick start

```bash
# Install dependencies
npm install

# Start Postgres + Redis
npm run docker:up

# Copy environment template
cp .env.example .env

# Migrate + seed dev integrator
npm run migrate
npm run seed

# Or all-in-one
npm run setup:dev

# Start dev server
npm run dev
```

The API listens on `http://localhost:3000`.

### Dev integrator credentials

After `npm run seed`:

| Variable | Value |
|----------|-------|
| API key | `echo_dev_api_key` |
| API secret | `echo_dev_api_secret` |

With `DEV_SKIP_HMAC=true` (default in `.env.example`), only `X-Api-Key` is required for local calls.

### Example: create session

```bash
curl -X POST http://localhost:3000/v1/server/sessions \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: echo_dev_api_key" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "integrator_user_id": "cust_xyz",
    "direction": "off_ramp",
    "source_asset": "RLUSD",
    "target_asset": "USD",
    "amount": "25000.00",
    "currency": "USD",
    "corridor": "US"
  }'
```

### Route prefixes

| Prefix | Purpose |
|--------|---------|
| `/v1/server` | Integrator backend (Server API) |
| `/v1/client` | Widget BFF (Client API) |
| `/v1/webhooks` | Inbound vendor webhooks |

## Adapter layout (v1.2 Lydiam/BCB)

| Adapter | Role |
|---------|------|
| `LydiamComplianceAdapter` | Compliance handoff — KYC/KYB pack to Lydiam programme |
| `BcbAdapter` | Fiat rails — named virtual accounts, deposit webhooks |
| `LydiamRoutingAdapter` | Ramp/FX — quotes and orders via Lydiam (no direct OTC bypass) |
| `PalisadeAdapter` | Legacy custody stub — not used in v1 non-custodial path |

Configure via `ROUTING_PROVIDER=lydiam` (default) and `FIAT_PROVIDER=bcb`.

## Design docs

- [System Design](design/System%20Design.md)
- [API Design](design/API%20Design.md)
- [Database Design](design/Database%20Design.md)
- [Architecture (repo root)](../RAMP_ARCHITECTURE_AND_FLOWS.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled output |
| `npm run migrate` | Apply SQL migrations |
| `npm run seed` | Seed dev integrator |
| `npm run docker:up` | Start Postgres + Redis |
| `npm run setup:dev` | Docker + migrate + seed |
| `npm test` | Run integration tests |

## Tests

Requires Postgres running with `echo_ramp_test` database (created automatically by `docker/init-db.sql`):

```bash
npm run docker:up
DATABASE_URL=postgresql://echo:echo@localhost:5432/echo_ramp_test npm run migrate
npm test
```

## Phase status

- Session create/get wired to PostgreSQL with idempotency
- Lydiam/BCB adapter layer with stub implementations
- Compliance handoff flow (Sumsub → pack → Lydiam)
- BCB webhook inbox + deposit processor
- Quote/order services via Lydiam routing with `compliance_pending` state
- Off-ramp integration test with mocked adapters

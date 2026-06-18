# Echo Ramp v1

Non-custodial on/off-ramp orchestration API for the Echo Ramp embeddable widget.

Echo coordinates licensed third-party providers (BVNK, routing partners, Plaid, Sumsub, Chainalysis) but never holds user funds. All outbound bank and crypto movements are user-authenticated.

## Stack

- **Runtime:** Node.js 20+, TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL
- **Cache / queue:** Redis (Phase 0 stub)

## Quick start

```bash
# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env

# Run migrations
npm run migrate

# Start dev server (hot reload)
npm run dev
```

The API listens on `http://localhost:3000` by default.

### Route prefixes

| Prefix | Purpose |
|--------|---------|
| `/v1/server` | Integrator backend (Server API) |
| `/v1/client` | Widget BFF (Client API) |
| `/v1/webhooks` | Inbound vendor webhooks |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run migrate` | Apply SQL migrations |
| `npm test` | Run unit tests |

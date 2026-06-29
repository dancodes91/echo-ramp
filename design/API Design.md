# Echo Ramp v1 — Integrator API Specification


**Version:** 1.2  
**Date:** 2026-06-18  
**Audience:** Integrator engineering teams, widget development  
**Base URL:** `https://api.echo.im/v1`


---


## 1. API Overview


The Echo Ramp API enables integrators to embed fiat ↔ RLUSD on‑/off‑ramp and RLUSD internal transfers inside their applications. The API is split into two interfaces:


| Interface | Used by | Authentication | Typical flow |
|-----------|---------|---------------|--------------|
| **Server API** | Integrator backend | `X-Api-Key` + HMAC signature | Create sessions, manage webhooks, fetch order status, reconcile |
| **Client API** | Echo Widget (frontend) | Session token (`Bearer`) | KYC, bank linking, wallet registration, quote acceptance, transfer initiation |


All mutations must include an `Idempotency-Key` header (UUID v4). The API guarantees exactly‑once processing for requests with the same idempotency key within 24 hours.


**Environments:**


| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api.sandbox.echo.im/v1` |
| Production | `https://api.echo.im/v1` |


Sandbox provides simulated provider responses, no real money movement. Integrator keys are environment‑specific.


---


## 2. Authentication & Security


### 2.1 Server API
- **API Key:** Passed in `X-Api-Key` header.
- **Request Signing:** All mutating requests (`POST`,`PUT`,`PATCH`,`DELETE`) must include an `X-Signature` header:
  ```
  HMAC-SHA256(api_secret, "{method}:{path}:{timestamp}:{body}")
  ```
  `timestamp` is Unix epoch seconds, also sent in `X-Timestamp` header. Replay protection: timestamp must be within ±5 minutes of server time.
- **Secrets:** Obtainable from the Echo Dashboard. Regenerate if compromised.


### 2.2 Client API
- **Session Token:** Returned by `POST /server/sessions`. The integrator passes this token to the widget (e.g., via `data-token` attribute or `postMessage`).
- The widget sends the token as an `Authorization: Bearer {session_token}` header on all Client API calls.
- Tokens expire after the session completes or after 30 minutes of inactivity. A new token can be obtained by re‑fetching the session (Server API).


### 2.3 Data Encryption
- All traffic must use TLS 1.3+.
- PII is encrypted at the application layer; never log plaintext secrets or tokens.


---


## 3. Common Patterns


### 3.1 Idempotency
- Every `POST`,`PUT`,`PATCH`,`DELETE` requires `Idempotency-Key: {uuid}`.
- Duplicate keys within the same path and resource scope return the stored response (status and body) and avoid side effects.
- If a request fails before a decision, retries with the same key are safe.


### 3.2 Pagination
Endpoints returning lists support:
```json
{
  "data": [...],
  "pagination": {
    "starting_after": "obj_id",
    "has_more": true
  }
}
```
Use `?starting_after={id}&limit={n}` (default 20, max 100). Lists are ordered by creation time descending.


### 3.3 Errors
All errors use [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) Problem Details format:
```json
{
  "type": "https://api.echo.im/errors/insufficient_funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "The linked bank account does not have sufficient balance.",
  "instance": "/v1/sessions/sess_abc123/quotes",
  "error_code": "bank_insufficient_funds"
}
```
Common error codes: `invalid_request`, `unauthorized`, `idempotency_key_reuse`, `session_expired`, `kyc_required`, `compliance_blocked`, `quote_expired`, `provider_unavailable`.


### 3.4 Assets & Amounts
- All amounts are strings to preserve precision: `"25000.50"`.
- Fiat currencies: `"USD"`, `"EUR"`, `"GBP"`.
- Crypto assets: `"RLUSD"` (primary v1 asset), `"USDC"`, `"USDT"` (supported where routing partner and corridor allow — configuration-driven).
- Amounts always include the currency: `{"amount": "1000.00", "currency": "USD"}`.


---


## 4. Data Models


### User (end‑user)
```json
{
  "id": "usr_9f7a",
  "integrator_user_id": "your-internal-id",
  "status": "active",
  "kyc": {
    "level": "advanced",
    "status": "approved"
  }
}
```


### Wallet
```json
{
  "id": "wal_4h2k",
  "address": "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  "chain": "XRPL",
  "tag": "12345",             // optional destination tag
  "label": "My RLUSD Wallet",
  "status": "approved"        // screening status: pending, approved, rejected
}
```


### Bank Account
```json
{
  "id": "bnk_j9d3",
  "provider": "plaid_us",
  "masked_account_number": "****1234",
  "institution_name": "Chase",
  "status": "linked"
}
```


### Named Fiat Account (BCB (Lydiam programme))
```json
{
  "id": "nfa_5g6h",
  "account_identifier": "US1234567890",
  "currency": "USD",
  "provider": "bcb"
}
```


### Quote
```json
{
  "id": "qte_x1y2",
  "pair": "USD/RLUSD",
  "direction": "on_ramp",
  "desk_rate": "0.9995",
  "fee_echo_percent": "0.15",
  "fee_integrator_percent": "0.10",
  "total_rate": "0.9970",
  "fiat_amount": "25000.00",
  "crypto_amount": "25062.56",
  "expires_at": "2026-06-16T14:30:00Z",
  "status": "ready"
}
```


### Order
```json
{
  "id": "ord_7f2a",
  "session_id": "sess_abc123",
  "quote_id": "qte_x1y2",
  "direction": "off_ramp",
  "status": "filled",
  "routing_provider": "ripple_otc",    // which provider filled this order
  "fiat_amount": "25000.00",
  "crypto_amount": "25062.56",
  "provider_deposit_address": "rProviderSettlementAddress...", // counterparty address for off-ramp; user sends stablecoin here from own wallet
  "tx_hash": "ABC123...",
  "created_at": "2026-06-16T12:00:00Z",
  "filled_at": "2026-06-16T12:15:00Z"
}
```


### Transfer (wallet‑to‑wallet)
```json
{
  "id": "txf_3k1j",
  "session_id": "sess_def456",
  "source_wallet": "rSource...",
  "destination_wallet": "rDest...",
  "amount": "1000.00",
  "currency": "RLUSD",
  "status": "screening_passed", // screening_passed | tx_broadcast | completed | failed
  "tx_hash": null,
  "screening_result": {
    "source": "approved",
    "destination": "approved"
  }
}
```


---


## 5. Server API (Integrator Backend)


Base path: `/v1/server`


### 5.1 Sessions


#### Create a Session
```
POST /server/sessions
```
Request body:
```json
{
  "integrator_user_id": "cust_xyz",
  "direction": "off_ramp",
  "source_asset": "RLUSD",
  "target_asset": "USD",
  "amount": "25000.00",
  "currency": "USD",               // fiat side
  "idempotency_key": "uuid",
  "corridor": "US",                // optional, inferred from fiat currency if omitted
  "metadata": {                    // optional, returned in webhooks
    "order_ref": "ORDER-123"
  }
}
```
Response `201`:
```json
{
  "session_id": "sess_abc123",
  "client_token": "eyJ...sess_token",   // JWT for Widget Client API
  "state": "kyc_required",
  "required_actions": ["kyc"],
  "created_at": "2026-06-16T12:00:00Z"
}
```
`client_token` must be kept secret and passed to the widget.


#### Retrieve a Session
```
GET /server/sessions/{session_id}
```
Response includes full session state, user/wallets/bank progress.


#### Cancel a Session
```
POST /server/sessions/{session_id}/cancel
```
Cancels any pending orders/quotes and marks session as `cancelled`.


### 5.2 Users


#### Lookup User
```
GET /server/users/{user_id}
```
Returns user KYC status, linked wallets, bank accounts.


#### Create or Retrieve User
```
POST /server/users/lookup
```
Body:
```json
{
  "integrator_user_id": "cust_xyz"
}
```
If exists, returns the user; else creates a new user record. Useful for lazy initialisation.


### 5.3 Webhook Management


#### Register Webhook Endpoint
```
POST /server/webhooks
```
Body:
```json
{
  "url": "https://partner.com/echo-webhook",
  "events": ["session.created", "quote.ready", "quote.accepted", "order.completed", "order.failed", "transfer.completed"],
  "secret": "wh_sec_..."  // optional, Echo will sign webhooks with this
}
```
Response: `webhook_subscription_id`.


#### List / Update / Delete Webhook
```
GET /server/webhooks
PUT /server/webhooks/{id}
DELETE /server/webhooks/{id}
```


#### Test Webhook
```
POST /server/webhooks/{id}/test
```
Sends a test ping with `{"event": "test"}`.


#### Retrieve Webhook Delivery Logs
```
GET /server/webhooks/{id}/deliveries?starting_after={id}&limit=20
```
Returns list of recent delivery attempts with status and response code.


### 5.4 Orders (Server‑side query)


#### Retrieve Order
```
GET /server/orders/{order_id}
```


#### List Orders
```
GET /server/orders?session_id={sid}&status=filled&starting_after={id}&limit=20
```


### 5.5 Transfers (Server‑side query)


#### Retrieve Transfer
```
GET /server/transfers/{transfer_id}
```


#### List Transfers
```
GET /server/transfers?session_id={sid}&status=completed&starting_after={id}


```
### 5.6 Sandbox Utilities
- `POST /sandbox/simulate/kyc` – simulate KYC approval/rejection for a user.
- `POST /sandbox/simulate/quote` – simulate a quote fill.
- `POST /sandbox/reset` – reset all sandbox data for the integrator.


---


## 6. Client API (Echo Widget)


Base path: `/v1/client`  
Authentication: `Authorization: Bearer {client_token}`


### 6.1 Session


#### Get Current Session State
```
GET /client/session
```
Returns everything the widget needs to render the current step.


#### Update Session Metadata
```
PATCH /client/session
```
Body: `{ "metadata": {...} }`


### 6.2 KYC


#### Initiate KYC
```
POST /client/kyc
```
If Sumsub embedded flow is used, returns a `token` and `url`.
```json
{
  "kyc_provider": "sumsub",
  "external_token": "sbx-...",
  "redirect_url": "https://sumsub.com/..."
}
```
Widget then opens the Sumsub WebSDK / redirect. Alternatively, Echo Widget can handle native integration.


#### KYC Status
```
GET /client/kyc
```
```json
{
  "level": "advanced",
  "status": "approved",
  "rejection_reason": null
}
```


### 6.3 Wallets


#### List Registered Wallets
```
GET /client/wallets
```


#### Add Wallet Address
```
POST /client/wallets
```
Body:
```json
{
  "address": "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  "chain": "XRPL",
  "tag": "12345",
  "label": "My Main"
}
```
Returns wallet with screening status `pending`. Echo triggers Lydiam/BCB (via programme routing) screen asynchronously; widget can poll status.


#### Get Wallet Screening Status
```
GET /client/wallets/{wallet_id}
```


#### Delete Wallet
```
DELETE /client/wallets/{wallet_id}
```


### 6.4 Bank Accounts


#### Initiate Bank Link (via aggregator)
```
POST /client/bank/links
```
Body:
```json
{
  "provider": "plaid_us"
}
```
Response:
```json
{
  "link_token": "link-sandbox-...",
  "provider": "plaid_us"
}
```
Widget uses Plaid Link (or TrueLayer/Volt SDK) to collect bank credentials. On success, Plaid returns a `public_token`.

> **Orchestration boundary:** Bank links are used for payment authorisation sessions that the **user** initiates and completes. Echo does not hold standing debit authority over the user's bank account and does not trigger outbound bank payments independently. Every bank movement is presented to the user in the widget and completed under their authentication.


#### Complete Bank Link (exchange public token)
```
POST /client/bank/links/{link_id}/complete
```
Body:
```json
{
  "public_token": "public-sandbox-...",
  "account_id": "..."   // optional, if Plaid Link returns multiple accounts
}
```
Echo exchanges for an access token and stores a reference. Returns the linked bank account.


#### List Bank Accounts
```
GET /client/bank/accounts
```


#### Unlink Bank Account
```
DELETE /client/bank/accounts/{account_id}
```


### 6.5 Named Fiat Accounts
These are provisioned automatically during onboarding, but can be fetched:
```
GET /client/named_accounts
```
Returns list of `{ id, account_identifier, currency }`. Widget may display the vIBAN to the user if needed.


### 6.6 Quotes


#### Request a Quote for the Session
```
POST /client/quotes
```
Optional body (overrides session defaults):
```json
{
  "pair": "USD/RLUSD",
  "fiat_amount": "50000.00"
}
```
Response: quote object with `status: "ready"`. The quote has an `expires_at`; the widget must display a countdown.


#### Retrieve Latest Quote
```
GET /client/quotes/latest
```


#### Accept Quote (Create Order)
```
POST /client/quotes/{quote_id}/accept
```
Body:
```json
{
  "wallet_id": "wal_4h2k",   // destination wallet for on-ramp, or source wallet for off-ramp
  "idempotency_key": "uuid"
}
```
Response: order object with `status: "pending_submission"` (for off‑ramp) or `submitted` (on‑ramp). For off‑ramp, includes `desk_deposit_address`.


### 6.7 Orders


#### Get Order Status
```
GET /client/orders/{order_id}
```


#### Confirm Off‑Ramp Stablecoin Send
After the user sends stablecoin from their own wallet to the provider's deposit address, the widget notifies Echo (and optionally provides the tx hash).
```
POST /client/orders/{order_id}/confirm-send
```
Body:
```json
{
  "tx_hash": "ABC..."
}
```
Echo verifies the transaction on‑chain (via Lydiam/BCB (via programme routing)/XRPL node) and updates order status.

#### Initiate User-Authenticated Bank Payout
Once the routing provider has credited fiat to the user's named account, the widget presents the bank transfer instruction and the user completes it here. Echo returns a payment authorisation session; the user completes the transfer in the aggregator's flow.
```
POST /client/orders/{order_id}/bank-payout
```
Body:
```json
{
  "bank_account_id": "bnk_j9d3",
  "idempotency_key": "uuid"
}
```
Response:
```json
{
  "payment_authorisation_id": "pauth_8k3f",
  "provider": "plaid_us",
  "link_token": "link-...",      // Plaid payment initiation token; use Plaid Link in widget
  "amount": "25000.00",
  "currency": "USD",
  "status": "initiated"
}
```
The widget opens the aggregator's payment flow using the returned token. The user authenticates and approves the bank transfer. Echo receives a status webhook from the aggregator and updates the order to `completed`.

> **Important:** Echo does not call the aggregator to initiate this payout. The user's authenticated action in the aggregator's flow triggers the payment. This endpoint only prepares the authorisation session and records it against the order.


### 6.8 Transfers (Wallet‑to‑Wallet)


#### Initiate Internal Transfer
```
POST /client/transfers
```
Body:
```json
{
  "source_wallet_id": "wal_4h2k",
  "destination_wallet_id": "wal_9k3f",
  "amount": "1000.00",
  "idempotency_key": "uuid"
}
```
Response: transfer object with `status: "screening_pending"`. Once both wallets are screened, status becomes `screening_passed`. Widget then instructs user to send RLUSD from source to destination.


#### Confirm Transfer Broadcast
```
POST /client/transfers/{transfer_id}/confirm
```
Body: `{ "tx_hash": "DEF..." }`. Echo records the ledger event and sets status to `completed` (or `failed` if the hash cannot be verified).


#### Get Transfer Status
```
GET /client/transfers/{transfer_id}
```


---


## 7. Webhooks


Echo sends server‑to‑server webhooks to the URL registered via `POST /server/webhooks`. Each delivery is signed with the secret (if configured) using `X-Echo-Signature: HMAC-SHA256(secret, payload)`.


### Event Types


| Event | Payload highlights | When |
|-------|-------------------|------|
| `session.created` | `session_id`, `integrator_user_id` | Session opened |
| `session.completed` | `session_id` | All steps finished |
| `session.failed` | `session_id`, `reason` | Terminal failure |
| `kyc.approved` | `user_id`, `level` | KYC tier passed |
| `quote.ready` | `quote` object | Quote available for user |
| `quote.expired` | `quote_id` | Quote expired without acceptance |
| `quote.accepted` | `order_id`, `quote_id` | User accepted quote, order created |
| `order.submitted` | `order` object | Order sent to OTC desk |
| `order.filled` | `order` object, `tx_hash` | Desk filled the order |
| `order.failed` | `order_id`, `reason` | Desk could not fill |
| `order.completed` | `order` object, `revenue_share` | Settlement complete, fiat/crypto moved |
| `transfer.screening_passed` | `transfer` object | Both wallets approved |
| `transfer.completed` | `transfer` object, `tx_hash` | On‑chain RLUSD movement confirmed |


### Webhook Signature Verification
Integrators should compute HMAC of the raw request body using the shared secret and compare to `X-Echo-Signature`. Always respond `200` quickly; any 2xx acknowledges receipt. Echo retries with exponential backoff (max 6 attempts over 1 hour) for non‑2xx responses.


---


## 8. SDK & Widget Integration


Echo provides a lightweight JavaScript SDK for the widget:
```html
<script src="https://cdn.echo.im/ramp/1.1/echo-ramp.js"></script>
<script>
  EchoRamp.mount('#ramp-container', {
    clientToken: 'eyJ...',   // obtained from your backend via POST /server/sessions
    environment: 'sandbox',   // 'production' for live
    onEvent: (event) => {     // optional callback for events
      console.log(event);
    },
    theme: { ... }
  });
</script>
```
The SDK handles all Client API calls internally; the integrator only needs to generate a `clientToken` via the Server API.


---


## 9. Rate Limits


| API Type | Limit |
|----------|-------|
| Server API | 1000 requests per minute per API key |
| Client API | 300 requests per minute per session |
| Webhook endpoints | 500 requests per hour per URL (burst 10/sec) |


Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Exceeding limits returns `429 Too Many Requests`.


---


## 10. Versioning & Deprecation


The API is versioned via URL path (`/v1/...`). Breaking changes will be introduced under a new version (`/v2/...`). Non‑breaking additions may appear in the current version. Deprecated endpoints will emit a `Sunset` header and remain functional for 6 months.


---


## 11. Error Code Reference


| Code | HTTP Status | Meaning |
|------|------------|---------|
| `invalid_request` | 400 | Malformed JSON, missing fields |
| `unauthorized` | 401 | Invalid API key or signature |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource does not exist |
| `idempotency_key_reuse` | 409 | Key reused with different body |
| `session_expired` | 410 | Client token expired |
| `kyc_required` | 403 | Action requires completed KYC |
| `compliance_blocked` | 422 | Lydiam/BCB (via programme routing) or sanctions block |
| `quote_expired` | 422 | Quote is no longer valid |
| `insufficient_funds` | 422 | Bank or wallet balance too low |
| `provider_unavailable` | 502 | Upstream provider failure |
| `rate_limited` | 429 | Too many requests |


---


## 12. Example Integration Flow (Off-Ramp)


1. **Integrator backend** calls `POST /server/sessions` with user ID, direction `off_ramp`, amount 25,000 USD. Receives `session_id` and `client_token`.
2. **Widget** initialised with `clientToken`. Calls `GET /client/session`; sees `kyc_required`.
3. User completes KYC (Sumsub flow via widget). Widget polls `GET /client/kyc` until approved.
4. Widget prompts user to link a bank account. Calls `POST /client/bank/links` to get Plaid token; user links bank; widget calls `POST /client/bank/links/{id}/complete`.
5. Widget asks user to register their stablecoin wallet. User selects from `GET /client/wallets` or adds one with `POST /client/wallets`.
6. Widget calls `POST /client/quotes`; displays quote with expiry countdown.
7. User accepts quote. Widget calls `POST /client/quotes/{id}/accept` with the source wallet ID.
8. Response includes `provider_deposit_address`. Widget displays it and instructs user to send exact stablecoin amount from their own wallet to that address.
9. User sends from their own wallet. Widget calls `POST /client/orders/{id}/confirm-send` with the tx hash.
10. Echo screens the inbound transaction (Lydiam/BCB (via programme routing)) and monitors the routing provider for fiat credit to the user's named BCB (Lydiam programme) account. Order moves to `filled`.
11. Widget presents the bank transfer instruction. User calls `POST /client/orders/{id}/bank-payout` to open a user-authenticated payment session. Widget opens the Plaid (or equivalent) payment flow; user approves the bank transfer to their external account. Echo receives a status webhook from the aggregator and updates the order. Echo does not initiate the payout itself.
12. Order moves to `completed`. Integrator backend receives `order.completed` webhook with revenue share. Reconciliation done.


10. Echo screens the transaction, waits for desk to credit fiat to the user’s named account, then instructs bank aggregator to pull to external bank (if configured). Order status moves to `filled`, then `completed`.
11. Integrator backend receives `order.completed` webhook with revenue share details. Reconciliation done.


---
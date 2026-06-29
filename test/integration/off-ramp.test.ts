import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app.js';
import { LydiamComplianceAdapter } from '../../src/adapters/compliance-handoff.adapter.js';
import { RoutingAdapterFactory, LydiamRoutingAdapter } from '../../src/adapters/routing.adapter.js';
import { closePool, getPool } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { namedAccountsRepo } from '../../src/db/repositories/named-accounts.repo.js';
import { DEV_INTEGRATOR, seedDevIntegrator } from '../../src/db/seed.js';
import { simulateComplianceCleared } from '../../src/queue/processors/order-status.processor.js';
import { WebhookDispatcherService } from '../../src/services/webhook-dispatcher.service.js';
import { NamedAccountStatus } from '../../src/types/index.js';

let app: FastifyInstance;

async function resetDatabase(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    TRUNCATE
      ledger_events,
      webhook_inbox,
      orders,
      quotes,
      user_wallets,
      user_named_fiat_accounts,
      compliance_submissions,
      compliance_packs,
      sumsub_kyc_profiles,
      idempotency_keys,
      sessions,
      end_users,
      integrator_accounts
    CASCADE
  `);
}

beforeAll(async () => {
  await runMigrations();
  app = await buildApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedDevIntegrator();
  LydiamComplianceAdapter.clearTestStore();
  LydiamRoutingAdapter.clearTestStore();
  RoutingAdapterFactory.reset();
  WebhookDispatcherService.clearDeliveryLog();
});

afterAll(async () => {
  if (app) await app.close();
  await closePool();
});

describe('off-ramp corridor E2E (mocked Lydiam/BCB)', () => {
  it('runs session â†’ KYC â†’ quote â†’ order â†’ BCB deposit â†’ filled', async () => {
    const idempotencyKey = randomUUID();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/server/sessions',
      headers: {
        'x-api-key': DEV_INTEGRATOR.apiKey,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      payload: {
        integrator_user_id: 'cust_offramp',
        direction: 'off_ramp',
        source_asset: 'RLUSD',
        target_asset: 'USD',
        amount: '25000.00',
        currency: 'USD',
        corridor: 'US',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const { session_id: sessionId, client_token: clientToken } = createResponse.json();

    const pool = getPool();
    const sessionRow = await pool.query('SELECT user_id FROM sessions WHERE id = $1', [sessionId]);
    const userId = sessionRow.rows[0].user_id as string;

    const kycWebhook = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/sumsub',
      headers: { 'content-type': 'application/json' },
      payload: {
        type: 'applicantReviewed',
        applicantId: 'sumsub-app-001',
        externalUserId: userId,
        reviewResult: { reviewAnswer: 'GREEN' },
        fixedInfo: {
          firstName: 'Jane',
          lastName: 'Doe',
          dob: '1990-05-15',
          nationality: 'US',
          addressLine1: '1 Main St',
          city: 'New York',
          postcode: '10001',
          country: 'US',
        },
      },
    });
    expect(kycWebhook.statusCode).toBe(200);

    const submissionRow = await pool.query(
      'SELECT status FROM compliance_submissions WHERE user_id = $1',
      [userId],
    );
    expect(submissionRow.rows[0]?.status).toBe('approved');

    await namedAccountsRepo.create({
      userId,
      accountIdentifier: 'GB00ECHO1234567890',
      currency: 'USD',
      bcbCorrelationId: `echo-${userId.slice(0, 8)}`,
      status: NamedAccountStatus.Active,
    });

    const quoteResponse = await app.inject({
      method: 'POST',
      url: '/v1/client/quotes',
      headers: {
        authorization: `Bearer ${clientToken}`,
        'content-type': 'application/json',
      },
      payload: { pair: 'RLUSD/USD', fiat_amount: '25000.00' },
    });
    expect(quoteResponse.statusCode).toBe(201);
    const quoteId = quoteResponse.json().quote_id;

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/v1/client/quotes/${quoteId}/accept`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(acceptResponse.statusCode).toBe(200);

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/v1/client/orders',
      headers: {
        authorization: `Bearer ${clientToken}`,
        'content-type': 'application/json',
      },
      payload: { quote_id: quoteId },
    });
    expect(orderResponse.statusCode).toBe(201);
    const orderBody = orderResponse.json();
    expect(orderBody.compliance_status).toBe('pending');
    expect(orderBody.programme_deposit_address).toBeDefined();

    const complianceEvents = WebhookDispatcherService.getDeliveryLog().filter(
      (e) => e.eventType === 'compliance_pending',
    );
    expect(complianceEvents.length).toBeGreaterThan(0);

    await simulateComplianceCleared(orderBody.provider_order_id);

    const bcbWebhook = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/bcb',
      headers: {
        'content-type': 'application/json',
        'x-bcb-signature': 'test',
      },
      payload: {
        transactions: [
          {
            id: 'bcb-tx-001',
            amount_actual: 25000,
            currency: 'USD',
            credit: true,
            iban: 'GB00ECHO1234567890',
            reference: `echo-${userId.slice(0, 8)}`,
          },
        ],
      },
    });
    expect(bcbWebhook.statusCode).toBe(202);

    const sessionState = await pool.query('SELECT state FROM sessions WHERE id = $1', [sessionId]);
    expect(sessionState.rows[0]?.state).toBe('order_filled');

    const ledger = await pool.query('SELECT event_type FROM ledger_events WHERE session_id = $1', [
      sessionId,
    ]);
    expect(ledger.rows.map((r) => r.event_type)).toContain('fiat_deposit');
  });
});


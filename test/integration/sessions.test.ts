import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app.js';
import { closePool, getPool } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { DEV_INTEGRATOR, seedDevIntegrator } from '../../src/db/seed.js';
import { hashApiKey } from '../../src/lib/crypto.js';

let app: FastifyInstance;

async function resetDatabase(): Promise<void> {
  const pool = getPool();
  await pool.query('TRUNCATE idempotency_keys, sessions, end_users, integrator_accounts CASCADE');
}

beforeAll(async () => {
  await runMigrations();
  app = await buildApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedDevIntegrator();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('POST /v1/server/sessions', () => {
  it('creates a session and persists to the database', async () => {
    const idempotencyKey = randomUUID();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/server/sessions',
      headers: {
        'x-api-key': DEV_INTEGRATOR.apiKey,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      payload: {
        integrator_user_id: 'cust_xyz',
        direction: 'off_ramp',
        source_asset: 'RLUSD',
        target_asset: 'USD',
        amount: '25000.00',
        currency: 'USD',
        corridor: 'US',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.session_id).toBeDefined();
    expect(body.client_token).toBeDefined();
    expect(body.state).toBe('kyc_required');
    expect(body.required_actions).toEqual(['kyc']);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/v1/server/sessions/${body.session_id}`,
      headers: {
        'x-api-key': DEV_INTEGRATOR.apiKey,
      },
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().session_id).toBe(body.session_id);
  });

  it('replays the same response for duplicate idempotency keys', async () => {
    const idempotencyKey = randomUUID();

    const first = await app.inject({
      method: 'POST',
      url: '/v1/server/sessions',
      headers: {
        'x-api-key': DEV_INTEGRATOR.apiKey,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      payload: {
        integrator_user_id: 'cust_xyz',
        direction: 'off_ramp',
        source_asset: 'RLUSD',
        target_asset: 'USD',
        amount: '25000.00',
        currency: 'USD',
      },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/v1/server/sessions',
      headers: {
        'x-api-key': DEV_INTEGRATOR.apiKey,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      payload: {
        integrator_user_id: 'cust_xyz',
        direction: 'off_ramp',
        source_asset: 'RLUSD',
        target_asset: 'USD',
        amount: '25000.00',
        currency: 'USD',
      },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().session_id).toBe(first.json().session_id);
  });

  it('rejects requests without a valid API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/server/sessions',
      headers: {
        'x-api-key': 'invalid',
        'idempotency-key': randomUUID(),
        'content-type': 'application/json',
      },
      payload: {
        integrator_user_id: 'cust_xyz',
        direction: 'off_ramp',
        source_asset: 'RLUSD',
        target_asset: 'USD',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('dev integrator seed', () => {
  it('stores a hashed API key', async () => {
    const pool = getPool();
    const result = await pool.query('SELECT api_key_hash FROM integrator_accounts LIMIT 1');
    expect(result.rows[0]?.api_key_hash).toBe(hashApiKey(DEV_INTEGRATOR.apiKey));
  });
});

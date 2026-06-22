import {
  EchoSession,
  EndUser,
  EndUserStatus,
  IntegratorAccount,
  IntegratorStatus,
  SessionDirection,
  SessionState,
} from '../types/index.js';

interface IntegratorRow {
  id: string;
  name: string;
  api_key_hash: string;
  api_secret_encrypted: string;
  revenue_share_bps: number;
  status: IntegratorStatus;
  created_at: Date;
  updated_at: Date;
}

interface EndUserRow {
  id: string;
  integrator_id: string;
  integrator_user_id: string;
  status: EndUserStatus;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow {
  id: string;
  integrator_id: string;
  user_id: string;
  direction: SessionDirection;
  source_asset: string;
  target_asset: string;
  amount_numeric: string | null;
  amount_currency: string | null;
  state: SessionState;
  corridor: string;
  metadata: Record<string, unknown>;
  idempotency_key: string;
  client_token_version: number;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export function mapIntegrator(row: IntegratorRow): IntegratorAccount {
  return {
    id: row.id,
    name: row.name,
    apiKeyHash: row.api_key_hash,
    revenueShareBps: row.revenue_share_bps,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapIntegratorWithSecret(row: IntegratorRow): IntegratorAccount & { apiSecret: string } {
  return {
    ...mapIntegrator(row),
    apiSecret: row.api_secret_encrypted,
  };
}

export function mapEndUser(row: EndUserRow): EndUser {
  return {
    id: row.id,
    integratorId: row.integrator_id,
    integratorUserId: row.integrator_user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSession(row: SessionRow): EchoSession {
  return {
    id: row.id,
    integratorId: row.integrator_id,
    userId: row.user_id,
    direction: row.direction,
    sourceAsset: row.source_asset,
    targetAsset: row.target_asset,
    amountNumeric: row.amount_numeric,
    amountCurrency: row.amount_currency,
    state: row.state,
    corridor: row.corridor,
    metadata: row.metadata ?? {},
    idempotencyKey: row.idempotency_key,
    clientTokenVersion: row.client_token_version,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

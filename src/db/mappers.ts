import {
  CompliancePackRecord,
  ComplianceSubmission,
  EchoOrder,
  EchoQuote,
  EchoSession,
  EndUser,
  IntegratorAccount,
  KycLevel,
  KycStatus,
  LedgerEvent,
  NamedFiatAccount,
  RoutingProvider,
} from '../types/index.js';
import type { QueryResultRow } from 'pg';

export interface KycProfile {
  id: string;
  userId: string;
  sumsubApplicantId: string;
  level: KycLevel;
  status: KycStatus;
  rawSnapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}


export function mapIntegrator(row: QueryResultRow): IntegratorAccount {
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

export function mapIntegratorWithSecret(row: QueryResultRow): IntegratorAccount & { apiSecret: string } {
  return {
    ...mapIntegrator(row),
    apiSecret: row.api_secret_encrypted,
  };
}

export function mapEndUser(row: QueryResultRow): EndUser {
  return {
    id: row.id,
    integratorId: row.integrator_id,
    integratorUserId: row.integrator_user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSession(row: QueryResultRow): EchoSession {
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

export function mapKycProfile(row: QueryResultRow): KycProfile {
  return {
    id: row.id,
    userId: row.user_id,
    sumsubApplicantId: row.sumsub_applicant_id,
    level: row.level,
    status: row.status,
    rawSnapshot: row.raw_snapshot ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCompliancePack(row: QueryResultRow): CompliancePackRecord {
  return {
    id: row.id,
    userId: row.user_id,
    pack: row.pack ?? {},
    version: row.version,
    createdAt: row.created_at,
  };
}

export function mapComplianceSubmission(row: QueryResultRow): ComplianceSubmission {
  return {
    id: row.id,
    packId: row.pack_id,
    userId: row.user_id,
    partner: row.partner,
    externalRef: row.external_ref,
    status: row.status,
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at,
  };
}

export function mapNamedFiatAccount(row: QueryResultRow): NamedFiatAccount {
  return {
    id: row.id,
    userId: row.user_id,
    accountIdentifier: row.account_identifier,
    currency: row.currency,
    provider: row.provider,
    bcbCorrelationId: row.bcb_correlation_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQuote(row: QueryResultRow): EchoQuote {
  return {
    id: row.id,
    sessionId: row.session_id,
    providerQuoteId: row.provider_quote_id,
    routingProvider: row.routing_provider as RoutingProvider,
    pair: row.pair,
    direction: row.direction,
    deskRate: row.desk_rate,
    feeEchoBps: row.fee_echo_bps,
    feeIntegratorBps: row.fee_integrator_bps,
    totalRate: row.total_rate,
    fiatAmount: row.fiat_amount,
    cryptoAmount: row.crypto_amount,
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOrder(row: QueryResultRow): EchoOrder {
  return {
    id: row.id,
    sessionId: row.session_id,
    quoteId: row.quote_id,
    providerOrderId: row.provider_order_id,
    direction: row.direction,
    fiatAmount: row.fiat_amount,
    cryptoAmount: row.crypto_amount,
    userWalletId: row.user_wallet_id,
    routingProvider: row.routing_provider as RoutingProvider | null,
    complianceStatus: row.compliance_status,
    programmeDepositAddress: row.programme_deposit_address,
    status: row.status,
    txHash: row.tx_hash,
    filledAt: row.filled_at,
    settledAt: row.settled_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLedgerEvent(row: QueryResultRow): LedgerEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    asset: row.asset,
    amount: row.amount,
    counterparty: row.counterparty,
    referenceId: row.reference_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}


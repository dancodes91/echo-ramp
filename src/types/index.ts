// ─── Enums ───────────────────────────────────────────────────────────────────

export enum SessionState {
  Created = 'created',
  KycRequired = 'kyc_required',
  KycOk = 'kyc_ok',
  ComplianceHandoffPending = 'compliance_handoff_pending',
  ComplianceHandoffOk = 'compliance_handoff_ok',
  NamedAccountPending = 'named_account_pending',
  BankLinkRequired = 'bank_link_required',
  WalletRequired = 'wallet_required',
  QuoteRequested = 'quote_requested',
  QuoteReady = 'quote_ready',
  OrderPending = 'order_pending',
  CompliancePending = 'compliance_pending',
  OrderFilled = 'order_filled',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum SessionDirection {
  OnRamp = 'on_ramp',
  OffRamp = 'off_ramp',
  WalletToWallet = 'wallet_to_wallet',
}

export enum OrderStatus {
  PendingSubmission = 'pending_submission',
  Submitted = 'submitted',
  CompliancePending = 'compliance_pending',
  PartiallyFilled = 'partially_filled',
  Filled = 'filled',
  Failed = 'failed',
  Settled = 'settled',
  Cancelled = 'cancelled',
}

export enum QuoteStatus {
  Pending = 'pending',
  Ready = 'ready',
  Accepted = 'accepted',
  Expired = 'expired',
  Rejected = 'rejected',
}

export enum KycLevel {
  Basic = 'basic',
  Advanced = 'advanced',
}

export enum KycStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum ComplianceSubmissionStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Review = 'review',
}

export enum ComplianceCheckpointStatus {
  Pending = 'pending',
  Cleared = 'cleared',
  Rejected = 'rejected',
}

export enum RoutingProvider {
  Lydiam = 'lydiam',
  Bcb = 'bcb',
  RippleOtc = 'ripple_otc',
  OpenFx = 'openfx',
}

export enum IntegratorWebhookEvent {
  Created = 'created',
  QuoteReady = 'quote_ready',
  QuoteAccepted = 'quote_accepted',
  CompliancePending = 'compliance_pending',
  StatusChange = 'status_change',
  Completed = 'completed',
  Failed = 'failed',
}

export enum AssetType {
  Fiat = 'fiat',
  Crypto = 'crypto',
}

export enum IntegratorStatus {
  Active = 'active',
  Suspended = 'suspended',
}

export enum EndUserStatus {
  Active = 'active',
  Blocked = 'blocked',
}

export enum BankLinkStatus {
  Linked = 'linked',
  Unlinked = 'unlinked',
}

export enum TransferStatus {
  Pending = 'pending',
  Submitted = 'submitted',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export enum LedgerEventType {
  FiatDeposit = 'fiat_deposit',
  FiatWithdrawal = 'fiat_withdrawal',
  CryptoDeposit = 'crypto_deposit',
  CryptoWithdrawal = 'crypto_withdrawal',
  OffRamp = 'off_ramp',
  OnRamp = 'on_ramp',
  Fee = 'fee',
  StateChange = 'state_change',
}

export enum NamedAccountStatus {
  Pending = 'pending',
  Active = 'active',
  Closed = 'closed',
}

// ─── Core domain interfaces ──────────────────────────────────────────────────

export interface EchoSession {
  id: string;
  integratorId: string;
  userId: string;
  direction: SessionDirection;
  sourceAsset: string;
  targetAsset: string;
  amountNumeric: string | null;
  amountCurrency: string | null;
  state: SessionState;
  corridor: string;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
  clientTokenVersion: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EchoQuote {
  id: string;
  sessionId: string;
  providerQuoteId: string | null;
  routingProvider: RoutingProvider;
  pair: string;
  direction: 'on_ramp' | 'off_ramp';
  deskRate: string;
  feeEchoBps: number;
  feeIntegratorBps: number;
  totalRate: string;
  fiatAmount: string;
  cryptoAmount: string;
  expiresAt: Date;
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EchoOrder {
  id: string;
  sessionId: string;
  quoteId: string | null;
  providerOrderId: string | null;
  direction: 'on_ramp' | 'off_ramp';
  fiatAmount: string;
  cryptoAmount: string;
  userWalletId: string | null;
  routingProvider: RoutingProvider | null;
  complianceStatus: ComplianceCheckpointStatus | null;
  programmeDepositAddress: string | null;
  status: OrderStatus;
  txHash: string | null;
  filledAt: Date | null;
  settledAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EchoTransfer {
  id: string;
  sessionId: string;
  sourceWalletId: string;
  destinationWalletId: string;
  asset: string;
  amount: string;
  txHash: string | null;
  status: TransferStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEvent {
  id: string;
  sessionId: string;
  eventType: LedgerEventType;
  asset: string;
  amount: string;
  counterparty: string;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IntegratorAccount {
  id: string;
  name: string;
  apiKeyHash: string;
  revenueShareBps: number;
  status: IntegratorStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EndUser {
  id: string;
  integratorId: string;
  integratorUserId: string;
  status: EndUserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompliancePackRecord {
  id: string;
  userId: string;
  pack: Record<string, unknown>;
  version: number;
  createdAt: Date;
}

export interface ComplianceSubmission {
  id: string;
  packId: string;
  userId: string;
  partner: string;
  externalRef: string | null;
  status: ComplianceSubmissionStatus;
  submittedAt: Date;
  resolvedAt: Date | null;
}

export interface NamedFiatAccount {
  id: string;
  userId: string;
  accountIdentifier: string;
  currency: string;
  provider: string;
  bcbCorrelationId: string;
  status: NamedAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  method: string;
  path: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

// ─── API request/response helpers ────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaymentAuthorizationSession {
  provider: string;
  sessionUrl: string;
  paymentIntentId: string;
  expiresAt: Date;
}

export type ExecutedBy = 'user' | 'provider';

export interface MoneyMovementAnnotation {
  executedBy: ExecutedBy;
  provider?: string;
}

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum SessionState {
  Created = 'created',
  KycRequired = 'kyc_required',
  KycOk = 'kyc_ok',
  BankLinkRequired = 'bank_link_required',
  WalletRequired = 'wallet_required',
  QuoteRequested = 'quote_requested',
  QuoteReady = 'quote_ready',
  OrderPending = 'order_pending',
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

export enum RoutingProvider {
  Bvnk = 'bvnk',
  RippleOtc = 'ripple_otc',
  OpenFx = 'openfx',
  Palisade = 'palisade',
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

export enum ScreeningStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
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
  Fee = 'fee',
  StateChange = 'state_change',
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
  deskQuoteId: string | null;
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
  deskOrderId: string | null;
  direction: 'on_ramp' | 'off_ramp';
  fiatAmount: string;
  cryptoAmount: string;
  userWalletId: string | null;
  routingProvider: RoutingProvider | null;
  providerDepositAddress: string | null;
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

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export const NOT_IMPLEMENTED =
  'Not implemented — awaiting vendor sandbox credentials';

// ─── Compliance handoff — KYC/KYB pack to regulated partners ─────────────────

export interface CompliancePack {
  userId: string;
  sumsubApplicantId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
  documentType?: string;
}

export type ComplianceSubmissionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'review';

export interface ComplianceSubmissionResult {
  submissionId: string;
  partner: string;
  externalRef: string | null;
  status: ComplianceSubmissionStatus;
}

export interface ComplianceHandoffAdapter {
  readonly partner: string;
  submitPack(pack: CompliancePack): Promise<ComplianceSubmissionResult>;
  getSubmissionStatus(submissionId: string): Promise<ComplianceSubmissionResult>;
}

// ─── Routing layer — quotes, orders via Lydiam programme ─────────────────────

export type ComplianceCheckpointStatus = 'pending' | 'cleared' | 'rejected';

export interface QuoteRequest {
  pair: string;
  direction: 'on_ramp' | 'off_ramp';
  fiatAmount: string;
  corridor: string;
}

export interface QuoteResponse {
  providerQuoteId: string;
  deskRate: string;
  cryptoAmount: string;
  expiresAt: Date;
}

export interface OrderSubmission {
  quoteId: string;
  sessionId: string;
  direction: 'on_ramp' | 'off_ramp';
  fiatAmount: string;
  cryptoAmount: string;
}

export interface OrderResponse {
  providerOrderId: string;
  status: string;
  programmeDepositAddress?: string;
  complianceStatus?: ComplianceCheckpointStatus;
}

export interface OrderStatusResponse {
  status: string;
  complianceStatus?: ComplianceCheckpointStatus;
}

export interface RoutingAdapter {
  readonly provider: string;
  requestQuote(input: QuoteRequest): Promise<QuoteResponse>;
  submitOrder(input: OrderSubmission): Promise<OrderResponse>;
  getOrderStatus(providerOrderId: string): Promise<OrderStatusResponse>;
}

// ─── BCB — fiat rails and named virtual accounts ───────────────────────────────

export interface VirtualAccountProvisionInput {
  userId: string;
  currency: string;
  correlationId: string;
  name: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
  nationality: string;
}

export interface NamedAccountProvisionResult {
  accountIdentifier: string;
  currency: string;
  correlationId: string;
  status: 'pending' | 'active';
}

export interface FiatRailsAdapter {
  readonly provider: 'bcb';
  provisionNamedAccount(
    input: VirtualAccountProvisionInput,
  ): Promise<NamedAccountProvisionResult>;
  getAccountDetails(
    accountIdentifier: string,
  ): Promise<{ accountIdentifier: string; currency: string; status: string }>;
  handleFiatReceiptWebhook(payload: unknown, signature: string | undefined): Promise<{
    iban: string;
    amount: string;
    currency: string;
    correlationId?: string;
    transactionId: string;
  }>;
}

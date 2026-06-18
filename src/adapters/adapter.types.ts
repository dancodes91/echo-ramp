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
  providerDepositAddress?: string;
}

export interface RoutingAdapter {
  readonly provider: string;
  requestQuote(input: QuoteRequest): Promise<QuoteResponse>;
  submitOrder(input: OrderSubmission): Promise<OrderResponse>;
  getOrderStatus(providerOrderId: string): Promise<{ status: string }>;
}

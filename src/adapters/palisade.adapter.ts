import {
  AdapterError,
  NOT_IMPLEMENTED,
  OrderResponse,
  OrderSubmission,
  QuoteRequest,
  QuoteResponse,
  RoutingAdapter,
} from './adapter.types.js';

/** Interim fallback adapter — used only if primary routing partners are delayed. */
export class PalisadeAdapter implements RoutingAdapter {
  readonly provider = 'palisade';

  async requestQuote(_input: QuoteRequest): Promise<QuoteResponse> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async submitOrder(_input: OrderSubmission): Promise<OrderResponse> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async getOrderStatus(_providerOrderId: string): Promise<{ status: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }
}

import {
  AdapterError,
  NOT_IMPLEMENTED,
  OrderResponse,
  OrderSubmission,
  QuoteRequest,
  QuoteResponse,
  RoutingAdapter,
} from './adapter.types.js';

export class BvnkAdapter implements RoutingAdapter {
  readonly provider = 'bvnk';

  async requestQuote(_input: QuoteRequest): Promise<QuoteResponse> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async submitOrder(_input: OrderSubmission): Promise<OrderResponse> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async getOrderStatus(_providerOrderId: string): Promise<{ status: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async provisionNamedAccount(_userId: string, _currency: string): Promise<{ accountIdentifier: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }
}

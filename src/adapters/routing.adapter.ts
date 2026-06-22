import { config } from '../config/index.js';
import {
  AdapterError,
  NOT_IMPLEMENTED,
  OrderResponse,
  OrderSubmission,
  QuoteRequest,
  QuoteResponse,
  RoutingAdapter,
} from './adapter.types.js';

class RippleOtcAdapter implements RoutingAdapter {
  readonly provider = 'ripple_otc';

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

class OpenFxAdapter implements RoutingAdapter {
  readonly provider = 'openfx';

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

function createRoutingAdapter(): RoutingAdapter {
  switch (config.ROUTING_PROVIDER) {
    case 'ripple_otc':
      return new RippleOtcAdapter();
    case 'openfx':
      return new OpenFxAdapter();
    default:
      throw new AdapterError(`Unknown routing provider: ${config.ROUTING_PROVIDER}`, 'routing');
  }
}

/** Ramp/FX execution — Ripple OTC desk or OpenFX. BVNK fiat rails are separate. */
export class RoutingAdapterFactory {
  private static instance: RoutingAdapter | null = null;

  static getAdapter(): RoutingAdapter {
    if (!this.instance) {
      this.instance = createRoutingAdapter();
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}

export { RoutingAdapterFactory as RoutingAdapterService };

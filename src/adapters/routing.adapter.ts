import { randomUUID } from 'node:crypto';

import { config } from '../config/index.js';
import {
  AdapterError,
  NOT_IMPLEMENTED,
  OrderResponse,
  OrderStatusResponse,
  OrderSubmission,
  QuoteRequest,
  QuoteResponse,
  RoutingAdapter,
} from './adapter.types.js';

const orderStore = new Map<string, OrderStatusResponse & { providerOrderId: string }>();

/** Primary v1.2 path — quote/order via Lydiam programme (mandatory compliance routing). */
class LydiamRoutingAdapter implements RoutingAdapter {
  readonly provider = 'lydiam';

  async requestQuote(input: QuoteRequest): Promise<QuoteResponse> {
    if (!config.LYDIAM_API_BASE_URL && config.NODE_ENV !== 'test') {
      throw new AdapterError(NOT_IMPLEMENTED, this.provider);
    }

    const providerQuoteId = `lydiam-q-${randomUUID().slice(0, 8)}`;
    return {
      providerQuoteId,
      deskRate: '1.0000',
      cryptoAmount: input.fiatAmount,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async submitOrder(input: OrderSubmission): Promise<OrderResponse> {
    const providerOrderId = `lydiam-o-${randomUUID().slice(0, 8)}`;
    orderStore.set(providerOrderId, {
      providerOrderId,
      status: 'submitted',
      complianceStatus: 'pending',
    });

    return {
      providerOrderId,
      status: 'submitted',
      programmeDepositAddress: `rLydiamProgrammeStub${input.sessionId.slice(0, 8)}`,
      complianceStatus: 'pending',
    };
  }

  async getOrderStatus(providerOrderId: string): Promise<OrderStatusResponse> {
    const stored = orderStore.get(providerOrderId);
    if (!stored) {
      throw new AdapterError('Order not found', this.provider, 'not_found', 404);
    }
    return stored;
  }

  static setOrderCleared(providerOrderId: string): void {
    const stored = orderStore.get(providerOrderId);
    if (stored) {
      orderStore.set(providerOrderId, {
        ...stored,
        status: 'filled',
        complianceStatus: 'cleared',
      });
    }
  }

  static clearTestStore(): void {
    orderStore.clear();
  }
}

class RippleOtcAdapter implements RoutingAdapter {
  readonly provider = 'ripple_otc';

  async requestQuote(_input: QuoteRequest): Promise<QuoteResponse> {
    throw new AdapterError(
      'Direct Ripple OTC routing bypasses Lydiam — not enabled in v1.2',
      this.provider,
      'bypass_blocked',
      403,
    );
  }

  async submitOrder(_input: OrderSubmission): Promise<OrderResponse> {
    throw new AdapterError(
      'Direct Ripple OTC routing bypasses Lydiam — not enabled in v1.2',
      this.provider,
      'bypass_blocked',
      403,
    );
  }

  async getOrderStatus(_providerOrderId: string): Promise<OrderStatusResponse> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }
}

class OpenFxAdapter implements RoutingAdapter {
  readonly provider = 'openfx';

  async requestQuote(_input: QuoteRequest): Promise<QuoteResponse> {
    throw new AdapterError(
      'Direct OpenFX routing bypasses Lydiam — not enabled in v1.2',
      this.provider,
      'bypass_blocked',
      403,
    );
  }

  async submitOrder(_input: OrderSubmission): Promise<OrderResponse> {
    throw new AdapterError(
      'Direct OpenFX routing bypasses Lydiam — not enabled in v1.2',
      this.provider,
      'bypass_blocked',
      403,
    );
  }

  async getOrderStatus(_providerOrderId: string): Promise<OrderStatusResponse> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }
}

function createRoutingAdapter(): RoutingAdapter {
  switch (config.ROUTING_PROVIDER) {
    case 'lydiam':
      return new LydiamRoutingAdapter();
    case 'ripple_otc':
      return new RippleOtcAdapter();
    case 'openfx':
      return new OpenFxAdapter();
    default:
      throw new AdapterError(`Unknown routing provider: ${config.ROUTING_PROVIDER}`, 'routing');
  }
}

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

export { RoutingAdapterFactory as RoutingAdapterService, LydiamRoutingAdapter };

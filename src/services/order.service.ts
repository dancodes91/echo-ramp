import { EchoOrder, OrderStatus } from '../types/index.js';
import { PaymentAuthorizationSession } from '../types/index.js';

export interface SubmitOrderInput {
  sessionId: string;
  quoteId: string;
}

export class OrderService {
  async submitOrder(_input: SubmitOrderInput): Promise<EchoOrder> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async getOrder(_orderId: string): Promise<EchoOrder | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async initiateBankPayout(_orderId: string, _bankLinkId: string): Promise<PaymentAuthorizationSession> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async updateStatus(_orderId: string, _status: OrderStatus): Promise<EchoOrder> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const orderService = new OrderService();

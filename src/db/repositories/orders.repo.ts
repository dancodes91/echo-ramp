import { EchoOrder, OrderStatus } from '../../types/index.js';

export class OrdersRepository {
  async findById(_id: string): Promise<EchoOrder | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async findBySessionId(_sessionId: string): Promise<EchoOrder | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async create(_input: Omit<EchoOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<EchoOrder> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async updateStatus(_id: string, _status: OrderStatus): Promise<EchoOrder> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const ordersRepo = new OrdersRepository();

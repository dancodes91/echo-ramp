import {
  ComplianceCheckpointStatus,
  EchoOrder,
  OrderStatus,
} from '../../types/index.js';
import { query } from '../client.js';
import { mapOrder } from '../mappers.js';

export class OrdersRepository {
  async findById(id: string): Promise<EchoOrder | null> {
    const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapOrder(result.rows[0]);
  }

  async findBySessionId(sessionId: string): Promise<EchoOrder | null> {
    const result = await query(
      `SELECT * FROM orders WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sessionId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapOrder(result.rows[0]);
  }

  async findByProviderOrderId(providerOrderId: string): Promise<EchoOrder | null> {
    const result = await query('SELECT * FROM orders WHERE provider_order_id = $1', [
      providerOrderId,
    ]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapOrder(result.rows[0]);
  }

  async create(input: Omit<EchoOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<EchoOrder> {
    const result = await query(
      `INSERT INTO orders (
         session_id, quote_id, provider_order_id, direction,
         fiat_amount, crypto_amount, user_wallet_id, routing_provider,
         compliance_status, programme_deposit_address, status,
         tx_hash, filled_at, settled_at, failure_reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        input.sessionId,
        input.quoteId,
        input.providerOrderId,
        input.direction,
        input.fiatAmount,
        input.cryptoAmount,
        input.userWalletId,
        input.routingProvider,
        input.complianceStatus,
        input.programmeDepositAddress,
        input.status,
        input.txHash,
        input.filledAt,
        input.settledAt,
        input.failureReason,
      ],
    );
    return mapOrder(result.rows[0]);
  }

  async updateStatus(id: string, status: OrderStatus): Promise<EchoOrder> {
    const result = await query(
      `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    if (result.rowCount === 0) {
      throw new Error(`Order not found: ${id}`);
    }
    return mapOrder(result.rows[0]);
  }

  async updateComplianceStatus(
    id: string,
    complianceStatus: ComplianceCheckpointStatus,
    status?: OrderStatus,
  ): Promise<EchoOrder> {
    const result = await query(
      `UPDATE orders
       SET compliance_status = $2,
           status = COALESCE($3, status),
           filled_at = CASE WHEN $3 = 'filled' THEN NOW() ELSE filled_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, complianceStatus, status ?? null],
    );
    if (result.rowCount === 0) {
      throw new Error(`Order not found: ${id}`);
    }
    return mapOrder(result.rows[0]);
  }
}

export const ordersRepo = new OrdersRepository();

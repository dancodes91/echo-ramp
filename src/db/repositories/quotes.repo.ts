import { EchoQuote, QuoteStatus } from '../../types/index.js';
import { query } from '../client.js';
import { mapQuote } from '../mappers.js';

export class QuotesRepository {
  async findById(id: string): Promise<EchoQuote | null> {
    const result = await query('SELECT * FROM quotes WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapQuote(result.rows[0]);
  }

  async findActiveBySessionId(sessionId: string): Promise<EchoQuote | null> {
    const result = await query(
      `SELECT * FROM quotes
       WHERE session_id = $1 AND status IN ('ready', 'accepted')
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapQuote(result.rows[0]);
  }

  async create(input: Omit<EchoQuote, 'id' | 'createdAt' | 'updatedAt'>): Promise<EchoQuote> {
    const result = await query(
      `INSERT INTO quotes (
         session_id, provider_quote_id, routing_provider, pair, direction,
         desk_rate, fee_echo_bps, fee_integrator_bps, total_rate,
         fiat_amount, crypto_amount, expires_at, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.sessionId,
        input.providerQuoteId,
        input.routingProvider,
        input.pair,
        input.direction,
        input.deskRate,
        input.feeEchoBps,
        input.feeIntegratorBps,
        input.totalRate,
        input.fiatAmount,
        input.cryptoAmount,
        input.expiresAt,
        input.status,
      ],
    );
    return mapQuote(result.rows[0]);
  }

  async updateStatus(id: string, status: QuoteStatus): Promise<EchoQuote> {
    const result = await query(
      `UPDATE quotes SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    if (result.rowCount === 0) {
      throw new Error(`Quote not found: ${id}`);
    }
    return mapQuote(result.rows[0]);
  }

  async expireStaleBySessionId(sessionId: string): Promise<void> {
    await query(
      `UPDATE quotes SET status = 'expired', updated_at = NOW()
       WHERE session_id = $1 AND status = 'ready' AND expires_at < NOW()`,
      [sessionId],
    );
  }
}

export const quotesRepo = new QuotesRepository();

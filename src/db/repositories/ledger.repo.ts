import { LedgerEvent } from '../../types/index.js';
import { query } from '../client.js';
import { mapLedgerEvent } from '../mappers.js';

export class LedgerRepository {
  async append(input: Omit<LedgerEvent, 'id' | 'createdAt'>): Promise<LedgerEvent> {
    const result = await query(
      `INSERT INTO ledger_events (
         session_id, event_type, asset, amount, counterparty, reference_id, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.sessionId,
        input.eventType,
        input.asset,
        input.amount,
        input.counterparty,
        input.referenceId,
        JSON.stringify(input.metadata),
      ],
    );
    return mapLedgerEvent(result.rows[0]);
  }

  async findBySessionId(sessionId: string): Promise<LedgerEvent[]> {
    const result = await query(
      `SELECT * FROM ledger_events WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId],
    );
    return result.rows.map(mapLedgerEvent);
  }
}

export const ledgerRepo = new LedgerRepository();


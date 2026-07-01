import { EchoSession, SessionState } from '../../types/index.js';
import { query } from '../client.js';
import { mapSession } from '../mappers.js';

export class SessionsRepository {
  async findById(id: string): Promise<EchoSession | null> {
    const result = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapSession(result.rows[0]);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<EchoSession | null> {
    const result = await query('SELECT * FROM sessions WHERE idempotency_key = $1', [
      idempotencyKey,
    ]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapSession(result.rows[0]);
  }

  async create(input: {
    integratorId: string;
    userId: string;
    direction: EchoSession['direction'];
    sourceAsset: string;
    targetAsset: string;
    amountNumeric?: string | null;
    amountCurrency?: string | null;
    state: SessionState;
    corridor: string;
    metadata: Record<string, unknown>;
    idempotencyKey: string;
    expiresAt: Date;
  }): Promise<EchoSession> {
    const result = await query(
      `INSERT INTO sessions (
         integrator_id, user_id, direction, source_asset, target_asset,
         amount_numeric, amount_currency, state, corridor, metadata,
         idempotency_key, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.integratorId,
        input.userId,
        input.direction,
        input.sourceAsset,
        input.targetAsset,
        input.amountNumeric ?? null,
        input.amountCurrency ?? null,
        input.state,
        input.corridor,
        JSON.stringify(input.metadata),
        input.idempotencyKey,
        input.expiresAt,
      ],
    );
    return mapSession(result.rows[0]);
  }

  /**
   * @internal Only SessionStateMachineService should call this directly.
   */
  async updateState(id: string, state: SessionState): Promise<EchoSession> {
    const result = await query(
      `UPDATE sessions SET state = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, state],
    );
    if (result.rowCount === 0) {
      throw new Error(`Session not found: ${id}`);
    }
    return mapSession(result.rows[0]);
  }

  /**
   * @internal Deprecated — use SessionStateMachineService.transitionEligibleSessionsForUser.
   */
  async updateStateForUser(userId: string, state: SessionState): Promise<void> {
    await query(
      `UPDATE sessions SET state = $2, updated_at = NOW()
       WHERE user_id = $1 AND state NOT IN ('completed', 'failed', 'cancelled')`,
      [userId, state],
    );
  }

  async findActiveByUserId(userId: string): Promise<EchoSession[]> {
    const result = await query(
      `SELECT * FROM sessions
       WHERE user_id = $1 AND state NOT IN ('completed', 'failed', 'cancelled')
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(mapSession);
  }
}

export const sessionsRepo = new SessionsRepository();

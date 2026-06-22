import { IdempotencyRecord } from '../../types/index.js';
import { query } from '../client.js';

interface IdempotencyRow {
  key: string;
  method: string;
  path: string;
  response_status: number;
  response_body: unknown;
  created_at: Date;
  expires_at: Date;
}

function mapIdempotency(row: IdempotencyRow): IdempotencyRecord {
  return {
    key: row.key,
    method: row.method,
    path: row.path,
    responseStatus: row.response_status,
    responseBody: row.response_body,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export class IdempotencyRepository {
  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const result = await query(
      'SELECT * FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [key],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapIdempotency(result.rows[0] as IdempotencyRow);
  }

  async store(record: {
    key: string;
    method: string;
    path: string;
    responseStatus: number;
    responseBody: unknown;
    expiresAt: Date;
  }): Promise<IdempotencyRecord> {
    const result = await query(
      `INSERT INTO idempotency_keys (key, method, path, response_status, response_body, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET
         response_status = EXCLUDED.response_status,
         response_body = EXCLUDED.response_body,
         expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [
        record.key,
        record.method,
        record.path,
        record.responseStatus,
        JSON.stringify(record.responseBody),
        record.expiresAt,
      ],
    );
    return mapIdempotency(result.rows[0] as IdempotencyRow);
  }
}

export const idempotencyRepo = new IdempotencyRepository();

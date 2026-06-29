import type { QueryResultRow } from 'pg';
import { query } from '../client.js';

export interface WebhookInboxRecord {
  id: string;
  source: string;
  payload: unknown;
  signatureVerified: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

function mapWebhookInbox(row: QueryResultRow): WebhookInboxRecord {
  return {
    id: row.id,
    source: row.source,
    payload: row.payload,
    signatureVerified: row.signature_verified,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

export class WebhooksRepository {
  async storeInbound(
    source: string,
    payload: unknown,
    signatureVerified = false,
  ): Promise<WebhookInboxRecord> {
    const result = await query(
      `INSERT INTO webhook_inbox (source, payload, signature_verified)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [source, JSON.stringify(payload), signatureVerified],
    );
    return mapWebhookInbox(result.rows[0]);
  }

  async markProcessed(id: string): Promise<void> {
    await query(`UPDATE webhook_inbox SET processed_at = NOW() WHERE id = $1`, [id]);
  }

  async findById(id: string): Promise<WebhookInboxRecord | null> {
    const result = await query('SELECT * FROM webhook_inbox WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapWebhookInbox(result.rows[0]);
  }
}

export const webhooksRepo = new WebhooksRepository();

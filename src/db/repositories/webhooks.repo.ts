import { IdempotencyRecord } from '../../types/index.js';

export class WebhooksRepository {
  async storeInbound(_provider: string, _payload: unknown): Promise<{ id: string }> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async markProcessed(_id: string): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export class IdempotencyRepository {
  async findByKey(_key: string): Promise<IdempotencyRecord | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async store(_record: Omit<IdempotencyRecord, 'createdAt'>): Promise<IdempotencyRecord> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const webhooksRepo = new WebhooksRepository();
export const idempotencyRepo = new IdempotencyRepository();

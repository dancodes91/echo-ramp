import { LedgerEvent } from '../../types/index.js';

export class LedgerRepository {
  async append(_input: Omit<LedgerEvent, 'id' | 'createdAt'>): Promise<LedgerEvent> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async findBySessionId(_sessionId: string): Promise<LedgerEvent[]> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const ledgerRepo = new LedgerRepository();

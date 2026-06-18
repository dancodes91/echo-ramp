import { LedgerEvent, LedgerEventType } from '../types/index.js';

export interface AppendLedgerEventInput {
  sessionId: string;
  eventType: LedgerEventType;
  asset: string;
  amount: string;
  counterparty: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export class LedgerService {
  async appendEvent(_input: AppendLedgerEventInput): Promise<LedgerEvent> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async getEventsForSession(_sessionId: string): Promise<LedgerEvent[]> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const ledgerService = new LedgerService();

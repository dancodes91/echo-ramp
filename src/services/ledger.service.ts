import { ledgerRepo } from '../db/repositories/ledger.repo.js';
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
  async appendEvent(input: AppendLedgerEventInput): Promise<LedgerEvent> {
    return ledgerRepo.append({
      sessionId: input.sessionId,
      eventType: input.eventType,
      asset: input.asset,
      amount: input.amount,
      counterparty: input.counterparty,
      referenceId: input.referenceId ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async getEventsForSession(sessionId: string): Promise<LedgerEvent[]> {
    return ledgerRepo.findBySessionId(sessionId);
  }
}

export const ledgerService = new LedgerService();

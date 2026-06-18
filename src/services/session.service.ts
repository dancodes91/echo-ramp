import { EchoSession, SessionDirection, SessionState } from '../types/index.js';

export interface CreateSessionInput {
  integratorId: string;
  userId: string;
  direction: SessionDirection;
  sourceAsset: string;
  targetAsset: string;
  amountNumeric?: string;
  amountCurrency?: string;
  corridor: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export class SessionService {
  async createSession(_input: CreateSessionInput): Promise<EchoSession> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async getSession(_sessionId: string): Promise<EchoSession | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async transitionState(_sessionId: string, _newState: SessionState): Promise<EchoSession> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const sessionService = new SessionService();

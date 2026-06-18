import { EchoSession, SessionState } from '../../types/index.js';

export class SessionsRepository {
  async findById(_id: string): Promise<EchoSession | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async create(_input: Omit<EchoSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<EchoSession> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async updateState(_id: string, _state: SessionState): Promise<EchoSession> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const sessionsRepo = new SessionsRepository();

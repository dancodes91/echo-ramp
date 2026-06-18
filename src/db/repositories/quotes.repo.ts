import { EchoQuote } from '../../types/index.js';

export class QuotesRepository {
  async findById(_id: string): Promise<EchoQuote | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async findActiveBySessionId(_sessionId: string): Promise<EchoQuote | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async create(_input: Omit<EchoQuote, 'id' | 'createdAt' | 'updatedAt'>): Promise<EchoQuote> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const quotesRepo = new QuotesRepository();

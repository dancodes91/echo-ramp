import { EchoQuote, QuoteStatus } from '../types/index.js';

export interface RequestQuoteInput {
  sessionId: string;
  pair: string;
  direction: 'on_ramp' | 'off_ramp';
  fiatAmount: string;
}

export class QuoteService {
  async requestQuote(_input: RequestQuoteInput): Promise<EchoQuote> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async acceptQuote(_quoteId: string): Promise<EchoQuote> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async getActiveQuote(_sessionId: string): Promise<EchoQuote | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async expireStaleQuotes(_sessionId: string): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  isQuoteValid(quote: EchoQuote): boolean {
    return quote.status === QuoteStatus.Ready && quote.expiresAt > new Date();
  }
}

export const quoteService = new QuoteService();

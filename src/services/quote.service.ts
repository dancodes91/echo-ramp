import { getRoutingAdapter } from '../adapters/index.js';
import { quotesRepo } from '../db/repositories/quotes.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { SessionStateError } from '../errors/session-state.error.js';
import { sessionStateMachine } from './session-state-machine.service.js';
import { EchoQuote, QuoteStatus, RoutingProvider, SessionState } from '../types/index.js';

export interface RequestQuoteInput {
  sessionId: string;
  pair: string;
  direction: 'on_ramp' | 'off_ramp';
  fiatAmount: string;
}

export class QuoteService {
  async requestQuote(input: RequestQuoteInput): Promise<EchoQuote> {
    const session = await sessionsRepo.findById(input.sessionId);
    if (!session) {
      throw new QuoteError('session_not_found', 'Session not found', 404);
    }

    await quotesRepo.expireStaleBySessionId(input.sessionId);

    if (session.state === SessionState.QuoteReady) {
      await sessionStateMachine.transition(
        input.sessionId,
        SessionState.QuoteRequested,
        'quote_requested',
      );
    } else if (session.state !== SessionState.QuoteRequested) {
      await sessionStateMachine.transition(
        input.sessionId,
        SessionState.QuoteRequested,
        'quote_requested',
      );
    }

    const routing = getRoutingAdapter();
    const quoteResponse = await routing.requestQuote({
      pair: input.pair,
      direction: input.direction,
      fiatAmount: input.fiatAmount,
      corridor: session.corridor,
    });

    const quote = await quotesRepo.create({
      sessionId: input.sessionId,
      providerQuoteId: quoteResponse.providerQuoteId,
      routingProvider: RoutingProvider.Lydiam,
      pair: input.pair,
      direction: input.direction,
      deskRate: quoteResponse.deskRate,
      feeEchoBps: 0,
      feeIntegratorBps: 0,
      totalRate: quoteResponse.deskRate,
      fiatAmount: input.fiatAmount,
      cryptoAmount: quoteResponse.cryptoAmount,
      expiresAt: quoteResponse.expiresAt,
      status: QuoteStatus.Ready,
    });

    await sessionStateMachine.transition(input.sessionId, SessionState.QuoteReady, 'quote_created');
    return quote;
  }

  async acceptQuote(quoteId: string, sessionId: string): Promise<EchoQuote> {
    const quote = await quotesRepo.findById(quoteId);
    if (!quote || quote.sessionId !== sessionId) {
      throw new QuoteError('quote_not_found', 'Quote not found', 404);
    }

    if (!this.isQuoteValid(quote)) {
      throw new QuoteError('quote_expired', 'Quote has expired', 410);
    }

    return quotesRepo.updateStatus(quoteId, QuoteStatus.Accepted);
  }

  async getActiveQuote(sessionId: string): Promise<EchoQuote | null> {
    await quotesRepo.expireStaleBySessionId(sessionId);
    return quotesRepo.findActiveBySessionId(sessionId);
  }

  async expireStaleQuotes(sessionId: string): Promise<void> {
    await quotesRepo.expireStaleBySessionId(sessionId);
  }

  isQuoteValid(quote: EchoQuote): boolean {
    return quote.status === QuoteStatus.Ready && quote.expiresAt > new Date();
  }
}

export class QuoteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'QuoteError';
  }
}

export function mapSessionStateError(err: SessionStateError): QuoteError {
  return new QuoteError(err.code, err.message, err.statusCode);
}

export const quoteService = new QuoteService();

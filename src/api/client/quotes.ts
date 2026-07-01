import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { sessionsRepo } from '../../db/repositories/sessions.repo.js';
import { SessionStateError } from '../../errors/session-state.error.js';
import { QuoteError, mapSessionStateError, quoteService } from '../../services/quote.service.js';

export const clientQuoteRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (request, reply) => {
    const sessionAuth = request.session;
    if (!sessionAuth) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }

    const body = request.body as { pair?: string; fiat_amount?: string };
    const session = await sessionsRepo.findById(sessionAuth.sessionId);
    if (!session) {
      return reply.status(404).send({ error: { code: 'not_found', message: 'Session not found' } });
    }

    const pair = body.pair ?? `${session.sourceAsset}/${session.targetAsset}`;
    const fiatAmount = body.fiat_amount ?? session.amountNumeric ?? '0';

    try {
      const quote = await quoteService.requestQuote({
        sessionId: session.id,
        pair,
        direction: session.direction === 'on_ramp' ? 'on_ramp' : 'off_ramp',
        fiatAmount,
      });

      return reply.status(201).send({
        quote_id: quote.id,
        provider_quote_id: quote.providerQuoteId,
        routing_provider: quote.routingProvider,
        desk_rate: quote.deskRate,
        fiat_amount: quote.fiatAmount,
        crypto_amount: quote.cryptoAmount,
        expires_at: quote.expiresAt.toISOString(),
        status: quote.status,
      });
    } catch (err) {
      if (err instanceof QuoteError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof SessionStateError) {
        const mapped = mapSessionStateError(err);
        return reply.status(mapped.statusCode).send({
          error: { code: mapped.code, message: mapped.message },
        });
      }
      throw err;
    }
  });

  app.post('/:quoteId/accept', async (request, reply) => {
    const sessionAuth = request.session;
    if (!sessionAuth) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }

    const { quoteId } = request.params as { quoteId: string };

    try {
      const quote = await quoteService.acceptQuote(quoteId, sessionAuth.sessionId);
      return reply.status(200).send({
        quote_id: quote.id,
        status: quote.status,
      });
    } catch (err) {
      if (err instanceof QuoteError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof SessionStateError) {
        const mapped = mapSessionStateError(err);
        return reply.status(mapped.statusCode).send({
          error: { code: mapped.code, message: mapped.message },
        });
      }
      throw err;
    }
  });
};


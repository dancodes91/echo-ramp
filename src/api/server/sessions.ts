import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { signClientToken } from '../../lib/jwt.js';
import { toSessionDetailResponse } from '../../lib/session-response.js';
import { SessionDirection } from '../../types/index.js';
import { sessionService, SessionError } from '../../services/session.service.js';

const createSessionSchema = z.object({
  integrator_user_id: z.string().min(1).max(255),
  direction: z.nativeEnum(SessionDirection),
  source_asset: z.string().min(1).max(10),
  target_asset: z.string().min(1).max(10),
  amount: z.string().optional(),
  currency: z.string().length(3).optional(),
  corridor: z.string().min(2).max(2).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotency_key: z.string().uuid().optional(),
});

function getIntegratorId(request: FastifyRequest): string {
  if (!request.integrator?.integratorId) {
    throw new SessionError('unauthorized', 'Integrator not authenticated', 401);
  }
  return request.integrator.integratorId;
}

function getIdempotencyKey(request: FastifyRequest): string {
  const headerKey = request.headers['idempotency-key'];
  if (typeof headerKey === 'string' && headerKey.length > 0) {
    return headerKey;
  }
  throw new SessionError('missing_idempotency_key', 'Idempotency-Key header is required', 400);
}

function handleSessionError(error: unknown, reply: FastifyReply) {
  if (error instanceof SessionError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      error: { code: 'validation_error', message: error.errors[0]?.message ?? 'Invalid request' },
    });
  }
  throw error;
}

export const serverSessionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (request, reply) => {
    try {
      const integratorId = getIntegratorId(request);
      const idempotencyKey = getIdempotencyKey(request);
      const body = createSessionSchema.parse(request.body);

      if (body.idempotency_key && body.idempotency_key !== idempotencyKey) {
        return reply.status(400).send({
          error: {
            code: 'idempotency_mismatch',
            message: 'Body idempotency_key must match Idempotency-Key header',
          },
        });
      }

      const result = await sessionService.createSession({
        integratorId,
        integratorUserId: body.integrator_user_id,
        direction: body.direction,
        sourceAsset: body.source_asset,
        targetAsset: body.target_asset,
        amountNumeric: body.amount,
        amountCurrency: body.currency,
        corridor: body.corridor,
        metadata: body.metadata,
        idempotencyKey,
      });

      return reply.status(201).send(result.responseBody);
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });

  app.get('/:sessionId', async (request, reply) => {
    try {
      const integratorId = getIntegratorId(request);
      const { sessionId } = request.params as { sessionId: string };

      const result = await sessionService.getSessionWithUser(sessionId, integratorId);
      if (!result) {
        return reply.status(404).send({
          error: { code: 'not_found', message: 'Session not found' },
        });
      }

      const clientToken = await signClientToken({
        sessionId: result.session.id,
        userId: result.session.userId,
        integratorId: result.session.integratorId,
        clientTokenVersion: result.session.clientTokenVersion,
      });

      return reply.send(
        toSessionDetailResponse(result.session, clientToken, result.integratorUserId),
      );
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });
};

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
    idempotencyKey?: string;
  }
}


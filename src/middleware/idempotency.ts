import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { idempotencyRepo } from '../db/repositories/idempotency.repo.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const IDEMPOTENCY_EXEMPT_PREFIXES = ['/v1/webhooks', '/health'];

function normalizePath(url: string): string {
  return url.split('?')[0] ?? url;
}

function requiresIdempotency(method: string, url: string): boolean {
  if (!MUTATING_METHODS.has(method)) {
    return false;
  }
  return !IDEMPOTENCY_EXEMPT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function registerIdempotencyMiddleware(app: FastifyInstance): void {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = normalizePath(request.url);

    if (!requiresIdempotency(request.method, url)) {
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return reply.status(400).send({
        error: {
          code: 'missing_idempotency_key',
          message: 'Idempotency-Key header is required for mutating requests',
        },
      });
    }

    request.idempotencyKey = idempotencyKey;

    const cached = await idempotencyRepo.findByKey(idempotencyKey);
    if (cached) {
      return reply.status(cached.responseStatus).send(cached.responseBody);
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.idempotencyKey) {
      return payload;
    }

    if (reply.statusCode < 200 || reply.statusCode >= 500) {
      return payload;
    }

    let responseBody: unknown;
    try {
      responseBody = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      return payload;
    }

    try {
      await idempotencyRepo.store({
        key: request.idempotencyKey,
        method: request.method,
        path: normalizePath(request.url),
        responseStatus: reply.statusCode,
        responseBody,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to store idempotency record');
    }

    return payload;
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

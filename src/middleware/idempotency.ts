import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const IDEMPOTENCY_EXEMPT_PREFIXES = ['/v1/webhooks', '/health'];

function requiresIdempotency(method: string, url: string): boolean {
  if (!MUTATING_METHODS.has(method)) {
    return false;
  }

  return !IDEMPOTENCY_EXEMPT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function registerIdempotencyMiddleware(app: FastifyInstance): void {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? request.url;

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

    // Phase 0: check idempotency_keys table for cached response — not yet wired
    request.log.debug({ idempotencyKey, path: url }, 'Idempotency key received');
  });
}

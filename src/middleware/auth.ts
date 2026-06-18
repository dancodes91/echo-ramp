import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedIntegrator {
  integratorId: string;
  name: string;
}

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  integratorId: string;
  clientTokenVersion: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    integrator?: AuthenticatedIntegrator;
    session?: AuthenticatedSession;
  }
}

const SERVER_PREFIX = '/v1/server';
const CLIENT_PREFIX = '/v1/client';
const WEBHOOK_PREFIX = '/v1/webhooks';

function isPublicRoute(url: string): boolean {
  return url === '/health' || url.startsWith(WEBHOOK_PREFIX);
}

function isClientRoute(url: string): boolean {
  return url.startsWith(CLIENT_PREFIX);
}

function isServerRoute(url: string): boolean {
  return url.startsWith(SERVER_PREFIX);
}

async function authenticateServerRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-api-key'];
  const signature = request.headers['x-signature'];
  const timestamp = request.headers['x-timestamp'];

  if (!apiKey || !signature || !timestamp) {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Missing API key or HMAC signature headers' },
    });
  }

  // Phase 0: lookup integrator by API key hash — not yet wired to DB
  request.integrator = {
    integratorId: '00000000-0000-0000-0000-000000000000',
    name: 'stub-integrator',
  };
}

async function authenticateClientRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Missing or invalid session token' },
    });
  }

  // Phase 0: validate JWT/session token — not yet wired to DB
  request.session = {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    integratorId: '00000000-0000-0000-0000-000000000000',
    clientTokenVersion: 1,
  };
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0] ?? request.url;

    if (isPublicRoute(url)) {
      return;
    }

    if (isClientRoute(url)) {
      await authenticateClientRequest(request, reply);
      return;
    }

    if (isServerRoute(url)) {
      await authenticateServerRequest(request, reply);
    }
  });
}

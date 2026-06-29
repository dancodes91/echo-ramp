import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { config } from '../config/index.js';
import { hashApiKey, verifyRequestSignature } from '../lib/crypto.js';
import { verifyClientToken } from '../lib/jwt.js';
import { integratorsRepo } from '../db/repositories/integrators.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';

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

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

function isPublicRoute(url: string): boolean {
  return url === '/health' || url.startsWith(WEBHOOK_PREFIX);
}

function isClientRoute(url: string): boolean {
  return url.startsWith(CLIENT_PREFIX);
}

function isServerRoute(url: string): boolean {
  return url.startsWith(SERVER_PREFIX);
}

function normalizePath(url: string): string {
  return url.split('?')[0] ?? url;
}

async function authenticateServerRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-api-key'];
  const signature = request.headers['x-signature'];
  const timestamp = request.headers['x-timestamp'];

  if (!apiKey || typeof apiKey !== 'string') {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Missing X-Api-Key header' },
    });
  }

  const integrator = await integratorsRepo.findByApiKeyHash(hashApiKey(apiKey));
  if (!integrator) {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Invalid API key' },
    });
  }

  request.integrator = {
    integratorId: integrator.id,
    name: integrator.name,
  };

  if (config.DEV_SKIP_HMAC && config.NODE_ENV !== 'production') {
    return;
  }

  if (!signature || !timestamp || typeof signature !== 'string' || typeof timestamp !== 'string') {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Missing X-Signature or X-Timestamp header' },
    });
  }

  const requestTime = Number(timestamp);
  if (Number.isNaN(requestTime) || Math.abs(Date.now() - requestTime) > TIMESTAMP_TOLERANCE_MS) {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Request timestamp expired or invalid' },
    });
  }

  const path = normalizePath(request.url);
  const body = request.rawBody ?? '';

  const valid = verifyRequestSignature(
    integrator.apiSecret,
    request.method,
    path,
    timestamp,
    body,
    signature,
  );

  if (!valid) {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Invalid request signature' },
    });
  }
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

  const token = authHeader.slice(7);

  try {
    const payload = await verifyClientToken(token);
    const session = await sessionsRepo.findById(payload.sessionId);

    if (!session) {
      return reply.status(401).send({
        error: { code: 'unauthorized', message: 'Session not found' },
      });
    }

    if (session.clientTokenVersion !== payload.clientTokenVersion) {
      return reply.status(401).send({
        error: { code: 'unauthorized', message: 'Session token revoked' },
      });
    }

    request.session = {
      sessionId: payload.sessionId,
      userId: payload.userId,
      integratorId: payload.integratorId,
      clientTokenVersion: payload.clientTokenVersion,
    };
  } catch {
    return reply.status(401).send({
      error: { code: 'unauthorized', message: 'Invalid session token' },
    });
  }
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const url = normalizePath(request.url);

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

export function registerRawBodyParser(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    request.rawBody = body as string;
    try {
      const parsed = body ? JSON.parse(body as string) : {};
      done(null, parsed);
    } catch (error) {
      done(error as Error);
    }
  });
}

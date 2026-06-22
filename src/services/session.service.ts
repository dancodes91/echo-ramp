import { EchoSession, SessionDirection, SessionState } from '../types/index.js';
import { signClientToken } from '../lib/jwt.js';
import { inferCorridor, initialSessionState, toCreateSessionResponse } from '../lib/session-response.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { usersRepo } from '../db/repositories/users.repo.js';

export interface CreateSessionInput {
  integratorId: string;
  integratorUserId: string;
  direction: SessionDirection;
  sourceAsset: string;
  targetAsset: string;
  amountNumeric?: string;
  amountCurrency?: string;
  corridor?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface CreateSessionResult {
  session: EchoSession;
  clientToken: string;
  responseBody: ReturnType<typeof toCreateSessionResponse>;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class SessionService {
  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const existing = await sessionsRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.integratorId !== input.integratorId) {
        throw new SessionError('forbidden', 'Idempotency key belongs to another integrator', 403);
      }
      const clientToken = await signClientToken({
        sessionId: existing.id,
        userId: existing.userId,
        integratorId: existing.integratorId,
        clientTokenVersion: existing.clientTokenVersion,
      });
      const responseBody = toCreateSessionResponse(existing, clientToken);
      return { session: existing, clientToken, responseBody };
    }

    const user = await usersRepo.upsert({
      integratorId: input.integratorId,
      integratorUserId: input.integratorUserId,
    });

    const corridor = inferCorridor(input.amountCurrency ?? 'USD', input.corridor);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const state = initialSessionState(input.direction);

    const session = await sessionsRepo.create({
      integratorId: input.integratorId,
      userId: user.id,
      direction: input.direction,
      sourceAsset: input.sourceAsset,
      targetAsset: input.targetAsset,
      amountNumeric: input.amountNumeric ?? null,
      amountCurrency: input.amountCurrency ?? null,
      state,
      corridor,
      metadata: input.metadata ?? {},
      idempotencyKey: input.idempotencyKey,
      expiresAt,
    });

    const clientToken = await signClientToken({
      sessionId: session.id,
      userId: session.userId,
      integratorId: session.integratorId,
      clientTokenVersion: session.clientTokenVersion,
    });

    const responseBody = toCreateSessionResponse(session, clientToken);
    return { session, clientToken, responseBody };
  }

  async getSession(sessionId: string, integratorId: string): Promise<EchoSession | null> {
    const session = await sessionsRepo.findById(sessionId);
    if (!session || session.integratorId !== integratorId) {
      return null;
    }
    return session;
  }

  async getSessionWithUser(
    sessionId: string,
    integratorId: string,
  ): Promise<{ session: EchoSession; integratorUserId: string } | null> {
    const session = await this.getSession(sessionId, integratorId);
    if (!session) {
      return null;
    }
    const user = await usersRepo.findById(session.userId);
    if (!user) {
      return null;
    }
    return { session, integratorUserId: user.integratorUserId };
  }

  async transitionState(sessionId: string, newState: SessionState): Promise<EchoSession> {
    return sessionsRepo.updateState(sessionId, newState);
  }
}

export class SessionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

export const sessionService = new SessionService();

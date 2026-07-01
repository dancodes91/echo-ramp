import {
  assertCanTransition,
  TransitionContext,
  TransitionReason,
} from '../domain/session-state-machine.js';
import { sessionContextRepo } from '../db/repositories/session-context.repo.js';
import { ordersRepo } from '../db/repositories/orders.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { SessionStateError } from '../errors/session-state.error.js';
import { config } from '../config/index.js';
import { ledgerService } from './ledger.service.js';
import { EchoSession, LedgerEventType, SessionState } from '../types/index.js';

export class SessionStateMachineService {
  async loadContext(sessionId: string): Promise<TransitionContext> {
    const session = await sessionsRepo.findById(sessionId);
    if (!session) {
      throw new SessionStateError('session_not_found', `Session not found: ${sessionId}`, 404);
    }

    const flags = await sessionContextRepo.loadUserFlags(session.userId);
    const order = await ordersRepo.findBySessionId(sessionId);

    return {
      session,
      ...flags,
      activeOrderId: order?.id,
    };
  }

  async transition(
    sessionId: string,
    to: SessionState,
    reason: TransitionReason,
    metadata?: Record<string, unknown>,
  ): Promise<EchoSession> {
    const ctx = await this.loadContext(sessionId);
    const from = ctx.session.state;

    if (from === to) {
      return ctx.session;
    }

    assertCanTransition(from, to, ctx, {
      relaxStateGuards: config.RELAX_STATE_GUARDS,
      reason,
    });

    const updated = await sessionsRepo.updateState(sessionId, to);

    await ledgerService.appendEvent({
      sessionId,
      eventType: LedgerEventType.StateChange,
      asset: 'SESSION',
      amount: '0',
      counterparty: 'echo',
      referenceId: undefined,
      metadata: { from, to, reason, ...metadata },
    });

    return updated;
  }

  async transitionEligibleSessionsForUser(
    userId: string,
    to: SessionState,
    reason: TransitionReason,
    filter?: (session: EchoSession) => boolean,
  ): Promise<void> {
    const sessions = await sessionsRepo.findActiveByUserId(userId);
    const eligible = filter ? sessions.filter(filter) : sessions;

    for (const session of eligible) {
      try {
        await this.transition(session.id, to, reason);
      } catch (err) {
        if (err instanceof SessionStateError && err.code === 'invalid_transition') {
          continue;
        }
        throw err;
      }
    }
  }
}

export const sessionStateMachine = new SessionStateMachineService();

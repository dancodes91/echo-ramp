import { describe, expect, it } from 'vitest';

import {
  allowedTargets,
  assertCanTransition,
  TransitionContext,
} from '../../src/domain/session-state-machine.js';
import { SessionStateError } from '../../src/errors/session-state.error.js';
import { EchoSession, SessionDirection, SessionState } from '../../src/types/index.js';

function makeSession(overrides: Partial<EchoSession> = {}): EchoSession {
  const now = new Date();
  return {
    id: 'sess-test',
    integratorId: 'int-test',
    userId: 'user-test',
    direction: SessionDirection.OffRamp,
    sourceAsset: 'RLUSD',
    targetAsset: 'USD',
    amountNumeric: '25000.00',
    amountCurrency: 'USD',
    state: SessionState.KycRequired,
    corridor: 'US',
    metadata: {},
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
    clientTokenVersion: 1,
    expiresAt: new Date(now.getTime() + 86_400_000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeContext(
  session: EchoSession,
  flags: Partial<Omit<TransitionContext, 'session'>> = {},
): TransitionContext {
  return {
    session,
    kycApproved: false,
    complianceSubmissionApproved: false,
    namedAccountActive: false,
    hasWallet: false,
    hasBankLink: false,
    ...flags,
  };
}

describe('session-state-machine', () => {
  describe('allowedTargets', () => {
    it('returns kyc_ok from kyc_required', () => {
      const targets = allowedTargets(SessionState.KycRequired);
      expect(targets).toContain(SessionState.KycOk);
      expect(targets).toContain(SessionState.Failed);
    });

    it('adds quote targets when relax guards enabled', () => {
      const strict = allowedTargets(SessionState.KycRequired, false);
      const relaxed = allowedTargets(SessionState.KycRequired, true);
      expect(strict).not.toContain(SessionState.QuoteReady);
      expect(relaxed).toContain(SessionState.QuoteRequested);
      expect(relaxed).toContain(SessionState.QuoteReady);
    });

    it('returns empty for terminal states', () => {
      expect(allowedTargets(SessionState.Completed)).toEqual([]);
      expect(allowedTargets(SessionState.Failed)).toEqual([]);
      expect(allowedTargets(SessionState.Cancelled)).toEqual([]);
    });
  });

  describe('assertCanTransition — happy path off-ramp', () => {
    it('walks kyc_required through compliance_pending', () => {
      let session = makeSession({ state: SessionState.KycRequired });
      let ctx = makeContext(session);

      assertCanTransition(session.state, SessionState.KycOk, makeContext(session, { kycApproved: true }), {
        reason: 'kyc_webhook_approved',
      });
      session = { ...session, state: SessionState.KycOk };
      assertCanTransition(session.state, SessionState.ComplianceHandoffPending, makeContext(session), {
        reason: 'compliance_pack_submitted',
      });
      session = { ...session, state: SessionState.ComplianceHandoffPending };
      assertCanTransition(
        session.state,
        SessionState.ComplianceHandoffOk,
        makeContext(session, { complianceSubmissionApproved: true }),
        { reason: 'compliance_partner_approved' },
      );
      session = { ...session, state: SessionState.ComplianceHandoffOk };
      assertCanTransition(session.state, SessionState.NamedAccountPending, makeContext(session), {
        reason: 'named_account_provision_started',
      });
      session = { ...session, state: SessionState.NamedAccountPending };
      assertCanTransition(
        session.state,
        SessionState.BankLinkRequired,
        makeContext(session, { namedAccountActive: true }),
        { reason: 'named_account_active' },
      );
      session = { ...session, state: SessionState.BankLinkRequired };
      assertCanTransition(session.state, SessionState.WalletRequired, makeContext(session));
      session = { ...session, state: SessionState.WalletRequired };
      assertCanTransition(
        session.state,
        SessionState.QuoteRequested,
        makeContext(session, { hasWallet: true }),
        { reason: 'quote_requested' },
      );
      session = { ...session, state: SessionState.QuoteRequested };
      assertCanTransition(session.state, SessionState.QuoteReady, makeContext(session), {
        reason: 'quote_created',
      });
      session = { ...session, state: SessionState.QuoteReady };
      assertCanTransition(session.state, SessionState.CompliancePending, makeContext(session), {
        reason: 'order_submitted',
      });
    });
  });

  describe('assertCanTransition — guard rails', () => {
    it('rejects kyc_required to quote_ready when relax guards off', () => {
      const session = makeSession({ state: SessionState.KycRequired });
      expect(() =>
        assertCanTransition(session.state, SessionState.QuoteReady, makeContext(session), {
          relaxStateGuards: false,
          reason: 'quote_created',
        }),
      ).toThrow(SessionStateError);
    });

    it('allows kyc_required to quote_ready when relax guards on', () => {
      const session = makeSession({ state: SessionState.KycRequired });
      expect(() =>
        assertCanTransition(session.state, SessionState.QuoteReady, makeContext(session), {
          relaxStateGuards: true,
          reason: 'quote_created',
        }),
      ).not.toThrow();
    });

    it('rejects compliance_pending to order_filled without settlement reason', () => {
      const session = makeSession({ state: SessionState.CompliancePending });
      expect(() =>
        assertCanTransition(session.state, SessionState.OrderFilled, makeContext(session), {
          reason: 'compliance_cleared',
        }),
      ).toThrow(SessionStateError);
    });

    it('allows compliance_pending to order_filled with fiat_deposit_matched', () => {
      const session = makeSession({ state: SessionState.CompliancePending });
      expect(() =>
        assertCanTransition(session.state, SessionState.OrderFilled, makeContext(session), {
          reason: 'fiat_deposit_matched',
        }),
      ).not.toThrow();
    });

    it('allows named_account_pending self-loop on provision retry', () => {
      const session = makeSession({ state: SessionState.NamedAccountPending });
      expect(() =>
        assertCanTransition(session.state, SessionState.NamedAccountPending, makeContext(session), {
          reason: 'named_account_provision_failed',
        }),
      ).not.toThrow();
    });

    it('rejects any outbound transition from terminal states', () => {
      for (const terminal of [
        SessionState.Completed,
        SessionState.Failed,
        SessionState.Cancelled,
      ]) {
        const session = makeSession({ state: terminal });
        expect(() =>
          assertCanTransition(session.state, SessionState.KycRequired, makeContext(session)),
        ).toThrow(SessionStateError);
      }
    });

    it('wallet_to_wallet requires wallet for quote_requested', () => {
      const session = makeSession({
        state: SessionState.WalletRequired,
        direction: SessionDirection.WalletToWallet,
      });
      expect(() =>
        assertCanTransition(session.state, SessionState.QuoteRequested, makeContext(session), {
          relaxStateGuards: false,
          reason: 'quote_requested',
        }),
      ).toThrow(SessionStateError);

      expect(() =>
        assertCanTransition(
          session.state,
          SessionState.QuoteRequested,
          makeContext(session, { hasWallet: true }),
          { relaxStateGuards: false, reason: 'quote_requested' },
        ),
      ).not.toThrow();
    });
  });
});

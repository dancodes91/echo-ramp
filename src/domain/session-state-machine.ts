import { SessionStateError } from '../errors/session-state.error.js';
import { EchoSession, SessionDirection, SessionState } from '../types/index.js';

export interface TransitionContext {
  session: EchoSession;
  kycApproved: boolean;
  complianceSubmissionApproved: boolean;
  namedAccountActive: boolean;
  hasWallet: boolean;
  hasBankLink: boolean;
  activeOrderId?: string;
}

export type TransitionReason =
  | 'kyc_webhook_approved'
  | 'compliance_pack_submitted'
  | 'compliance_partner_approved'
  | 'named_account_provision_started'
  | 'named_account_active'
  | 'named_account_provision_failed'
  | 'bank_link_completed'
  | 'wallet_registered'
  | 'quote_requested'
  | 'quote_created'
  | 'order_submitted'
  | 'compliance_cleared'
  | 'compliance_rejected'
  | 'fiat_deposit_matched'
  | 'order_filled'
  | 'payout_completed'
  | 'manual_admin';

const TERMINAL_STATES = new Set<SessionState>([
  SessionState.Completed,
  SessionState.Failed,
  SessionState.Cancelled,
]);

const BASE_TRANSITIONS: Record<SessionState, SessionState[]> = {
  [SessionState.Created]: [SessionState.KycRequired, SessionState.WalletRequired],
  [SessionState.KycRequired]: [SessionState.KycOk, SessionState.Failed, SessionState.Cancelled],
  [SessionState.KycOk]: [
    SessionState.ComplianceHandoffPending,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.ComplianceHandoffPending]: [
    SessionState.ComplianceHandoffOk,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.ComplianceHandoffOk]: [
    SessionState.NamedAccountPending,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.NamedAccountPending]: [
    SessionState.BankLinkRequired,
    SessionState.NamedAccountPending,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.BankLinkRequired]: [
    SessionState.WalletRequired,
    SessionState.QuoteRequested,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.WalletRequired]: [
    SessionState.QuoteRequested,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.QuoteRequested]: [
    SessionState.QuoteReady,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.QuoteReady]: [
    SessionState.QuoteRequested,
    SessionState.CompliancePending,
    SessionState.OrderPending,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.OrderPending]: [
    SessionState.CompliancePending,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.CompliancePending]: [
    SessionState.OrderFilled,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.OrderFilled]: [
    SessionState.Completed,
    SessionState.Failed,
    SessionState.Cancelled,
  ],
  [SessionState.Completed]: [],
  [SessionState.Failed]: [],
  [SessionState.Cancelled]: [],
};

const QUOTE_RELAX_TARGETS = new Set<SessionState>([
  SessionState.QuoteRequested,
  SessionState.QuoteReady,
]);

const SETTLEMENT_REASONS = new Set<TransitionReason>([
  'fiat_deposit_matched',
  'order_filled',
]);

export function allowedTargets(from: SessionState, relaxStateGuards = false): SessionState[] {
  const base = BASE_TRANSITIONS[from] ?? [];
  if (!relaxStateGuards || TERMINAL_STATES.has(from)) {
    return [...base];
  }

  const relaxed = new Set(base);
  for (const target of QUOTE_RELAX_TARGETS) {
    relaxed.add(target);
  }
  if (from === SessionState.KycRequired) {
    relaxed.add(SessionState.QuoteReady);
  }
  return [...relaxed];
}

function isWalletToWallet(session: EchoSession): boolean {
  return session.direction === SessionDirection.WalletToWallet;
}

function checkPrerequisites(
  from: SessionState,
  to: SessionState,
  ctx: TransitionContext,
  reason: TransitionReason,
  relaxStateGuards: boolean,
): string[] {
  const missing: string[] = [];

  if (to === SessionState.KycOk && !ctx.kycApproved) {
    missing.push('kyc_approved');
  }

  if (to === SessionState.ComplianceHandoffOk && !ctx.complianceSubmissionApproved) {
    missing.push('compliance_submission_approved');
  }

  if (to === SessionState.BankLinkRequired && !ctx.namedAccountActive) {
    missing.push('named_account_active');
  }

  if (to === SessionState.QuoteRequested && !relaxStateGuards && !isWalletToWallet(ctx.session)) {
    if (!ctx.hasWallet && from === SessionState.WalletRequired) {
      missing.push('wallet');
    }
    if (
      ctx.session.direction === SessionDirection.OnRamp &&
      !ctx.hasWallet &&
      from === SessionState.BankLinkRequired
    ) {
      missing.push('wallet');
    }
  }

  if (
    to === SessionState.QuoteRequested &&
    !relaxStateGuards &&
    isWalletToWallet(ctx.session) &&
    !ctx.hasWallet
  ) {
    missing.push('wallet');
  }

  if (
    to === SessionState.OrderFilled &&
    from === SessionState.CompliancePending &&
    !SETTLEMENT_REASONS.has(reason)
  ) {
    missing.push('settlement_signal');
  }

  return missing;
}

function isGraphEdgeAllowed(
  from: SessionState,
  to: SessionState,
  relaxStateGuards: boolean,
): boolean {
  if (from === to) {
    return from === SessionState.NamedAccountPending;
  }

  const targets = allowedTargets(from, relaxStateGuards);
  return targets.includes(to);
}

export function assertCanTransition(
  from: SessionState,
  to: SessionState,
  ctx: TransitionContext,
  options: { relaxStateGuards?: boolean; reason?: TransitionReason } = {},
): void {
  const relaxStateGuards = options.relaxStateGuards ?? false;
  const reason = options.reason ?? 'manual_admin';

  if (TERMINAL_STATES.has(from)) {
    throw new SessionStateError(
      'invalid_transition',
      `Cannot transition from terminal state ${from}`,
      409,
      { from, to },
    );
  }

  if (!isGraphEdgeAllowed(from, to, relaxStateGuards)) {
    throw new SessionStateError(
      'invalid_transition',
      `Cannot transition from ${from} to ${to}`,
      409,
      { from, to },
    );
  }

  const missing = checkPrerequisites(from, to, ctx, reason, relaxStateGuards);
  if (missing.length > 0) {
    throw new SessionStateError(
      'prerequisite_missing',
      `Missing prerequisites for transition from ${from} to ${to}: ${missing.join(', ')}`,
      422,
      { from, to, missing },
    );
  }
}

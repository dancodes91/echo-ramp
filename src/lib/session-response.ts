import { EchoSession, SessionState } from '../types/index.js';

export function deriveRequiredActions(state: SessionState): string[] {
  switch (state) {
    case SessionState.KycRequired:
      return ['kyc'];
    case SessionState.BankLinkRequired:
      return ['bank_link'];
    case SessionState.WalletRequired:
      return ['wallet'];
    case SessionState.QuoteRequested:
    case SessionState.QuoteReady:
      return ['quote'];
    case SessionState.OrderPending:
    case SessionState.OrderFilled:
      return ['order'];
    default:
      return [];
  }
}

export interface CreateSessionApiResponse {
  session_id: string;
  client_token: string;
  state: string;
  required_actions: string[];
  created_at: string;
}

export interface SessionDetailApiResponse extends CreateSessionApiResponse {
  integrator_user_id?: string;
  direction: string;
  source_asset: string;
  target_asset: string;
  amount: string | null;
  currency: string | null;
  corridor: string;
  metadata: Record<string, unknown>;
  expires_at: string;
  updated_at: string;
}

export function toCreateSessionResponse(
  session: EchoSession,
  clientToken: string,
): CreateSessionApiResponse {
  return {
    session_id: session.id,
    client_token: clientToken,
    state: session.state,
    required_actions: deriveRequiredActions(session.state),
    created_at: session.createdAt.toISOString(),
  };
}

export function toSessionDetailResponse(
  session: EchoSession,
  clientToken: string | null,
  integratorUserId?: string,
): SessionDetailApiResponse {
  return {
    ...toCreateSessionResponse(session, clientToken ?? ''),
    client_token: clientToken ?? '',
    integrator_user_id: integratorUserId,
    direction: session.direction,
    source_asset: session.sourceAsset,
    target_asset: session.targetAsset,
    amount: session.amountNumeric,
    currency: session.amountCurrency,
    corridor: session.corridor,
    metadata: session.metadata,
    expires_at: session.expiresAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
  };
}

export function inferCorridor(currency: string, explicitCorridor?: string): string {
  if (explicitCorridor) {
    return explicitCorridor.toUpperCase();
  }

  switch (currency.toUpperCase()) {
    case 'USD':
      return 'US';
    case 'GBP':
      return 'GB';
    case 'EUR':
      return 'EU';
    default:
      return 'US';
  }
}

export function initialSessionState(direction: string): SessionState {
  if (direction === 'wallet_to_wallet') {
    return SessionState.WalletRequired;
  }
  return SessionState.KycRequired;
}

import { AdapterError, NOT_IMPLEMENTED } from './adapter.types.js';

/**
 * Legacy Ripple MPC custody — not part of Ramp v1 non-custodial path.
 * Retained as optional stub only; not wired into RoutingAdapter or fiat rails.
 */
export class PalisadeAdapter {
  readonly provider = 'palisade';

  async createWallet(_userId: string): Promise<{ walletId: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }
}

import {
  AdapterError,
  FiatRailsAdapter,
  NamedAccountProvisionResult,
  NOT_IMPLEMENTED,
} from './adapter.types.js';

/** Fiat rails — named accounts and fiat receipt webhooks. Not used for ramp/FX quotes. */
export class BvnkAdapter implements FiatRailsAdapter {
  readonly provider = 'bvnk' as const;

  async provisionNamedAccount(_userId: string, _currency: string): Promise<NamedAccountProvisionResult> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async getAccountDetails(_accountIdentifier: string): Promise<{ accountIdentifier: string; currency: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }

  async handleFiatReceiptWebhook(_payload: unknown): Promise<void> {
    throw new AdapterError(NOT_IMPLEMENTED, this.provider);
  }
}

let bvnkInstance: BvnkAdapter | null = null;

export function getBvnkAdapter(): BvnkAdapter {
  if (!bvnkInstance) {
    bvnkInstance = new BvnkAdapter();
  }
  return bvnkInstance;
}

import { AdapterError, NOT_IMPLEMENTED } from './adapter.types.js';
import { PaymentAuthorizationSession } from '../types/index.js';

export class BankAggregatorAdapter {
  async createLinkSession(_userId: string, _corridor: string): Promise<{ linkUrl: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, 'bank_aggregator');
  }

  async createPaymentAuthorizationSession(
    _userId: string,
    _bankLinkId: string,
    _amount: string,
    _currency: string,
  ): Promise<PaymentAuthorizationSession> {
    throw new AdapterError(NOT_IMPLEMENTED, 'bank_aggregator');
  }
}

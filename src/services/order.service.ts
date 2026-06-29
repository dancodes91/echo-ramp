import { getRoutingAdapter } from '../adapters/index.js';
import { ordersRepo } from '../db/repositories/orders.repo.js';
import { quotesRepo } from '../db/repositories/quotes.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { webhookDispatcherService } from './webhook-dispatcher.service.js';
import {
  ComplianceCheckpointStatus,
  EchoOrder,
  OrderStatus,
  PaymentAuthorizationSession,
  QuoteStatus,
  RoutingProvider,
  SessionState,
} from '../types/index.js';

export interface SubmitOrderInput {
  sessionId: string;
  quoteId: string;
  integratorId: string;
}

export class OrderService {
  async submitOrder(input: SubmitOrderInput): Promise<EchoOrder> {
    const session = await sessionsRepo.findById(input.sessionId);
    if (!session) {
      throw new OrderError('session_not_found', 'Session not found', 404);
    }

    const quote = await quotesRepo.findById(input.quoteId);
    if (!quote || quote.sessionId !== input.sessionId) {
      throw new OrderError('quote_not_found', 'Quote not found', 404);
    }

    if (quote.status !== QuoteStatus.Accepted && quote.status !== QuoteStatus.Ready) {
      throw new OrderError('quote_invalid', 'Quote must be accepted before submitting order', 422);
    }

    const routing = getRoutingAdapter();
    const orderResponse = await routing.submitOrder({
      quoteId: quote.providerQuoteId ?? input.quoteId,
      sessionId: input.sessionId,
      direction: quote.direction,
      fiatAmount: quote.fiatAmount,
      cryptoAmount: quote.cryptoAmount,
    });

    const order = await ordersRepo.create({
      sessionId: input.sessionId,
      quoteId: input.quoteId,
      providerOrderId: orderResponse.providerOrderId,
      direction: quote.direction,
      fiatAmount: quote.fiatAmount,
      cryptoAmount: quote.cryptoAmount,
      userWalletId: null,
      routingProvider: RoutingProvider.Lydiam,
      complianceStatus:
        orderResponse.complianceStatus === 'pending'
          ? ComplianceCheckpointStatus.Pending
          : orderResponse.complianceStatus === 'cleared'
            ? ComplianceCheckpointStatus.Cleared
            : orderResponse.complianceStatus === 'rejected'
              ? ComplianceCheckpointStatus.Rejected
              : null,
      programmeDepositAddress: orderResponse.programmeDepositAddress ?? null,
      status: OrderStatus.CompliancePending,
      txHash: null,
      filledAt: null,
      settledAt: null,
      failureReason: null,
    });

    await sessionsRepo.updateState(input.sessionId, SessionState.CompliancePending);

    await webhookDispatcherService.dispatch(input.integratorId, {
      eventType: 'compliance_pending',
      sessionId: input.sessionId,
      data: {
        order_id: order.id,
        compliance_status: order.complianceStatus,
        programme_deposit_address: order.programmeDepositAddress,
      },
      timestamp: new Date(),
    });

    return order;
  }

  async getOrder(orderId: string): Promise<EchoOrder | null> {
    return ordersRepo.findById(orderId);
  }

  async initiateBankPayout(
    _orderId: string,
    _bankLinkId: string,
  ): Promise<PaymentAuthorizationSession> {
    throw new OrderError(
      'not_implemented',
      'Bank payout requires user authentication via Plaid — awaiting sandbox',
      501,
    );
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<EchoOrder> {
    return ordersRepo.updateStatus(orderId, status);
  }
}

export class OrderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

export const orderService = new OrderService();

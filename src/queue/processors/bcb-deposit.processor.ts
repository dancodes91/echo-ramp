import { namedAccountsRepo } from '../../db/repositories/named-accounts.repo.js';
import { ordersRepo } from '../../db/repositories/orders.repo.js';
import { sessionsRepo } from '../../db/repositories/sessions.repo.js';
import { webhooksRepo } from '../../db/repositories/webhooks.repo.js';
import { ledgerService } from '../../services/ledger.service.js';
import { sessionStateMachine } from '../../services/session-state-machine.service.js';
import { webhookDispatcherService } from '../../services/webhook-dispatcher.service.js';
import {
  ComplianceCheckpointStatus,
  LedgerEventType,
  OrderStatus,
  SessionDirection,
  SessionState,
} from '../../types/index.js';

export interface BcbDepositPayload {
  iban: string;
  amount: string;
  currency: string;
  correlationId?: string;
  transactionId: string;
}

export async function processBcbDeposit(
  deposit: BcbDepositPayload,
  inboxId: string,
): Promise<void> {
  const namedAccount = await namedAccountsRepo.findByAccountIdentifier(deposit.iban);
  if (!namedAccount) {
    await webhooksRepo.markProcessed(inboxId);
    return;
  }

  const sessions = await sessionsRepo.findActiveByUserId(namedAccount.userId);
  let matchedOrder = null;
  let matchedSession = null;

  for (const session of sessions) {
    const order = await ordersRepo.findBySessionId(session.id);
    if (order) {
      matchedOrder = order;
      matchedSession = session;
      break;
    }
  }

  if (!matchedSession) {
    await webhooksRepo.markProcessed(inboxId);
    return;
  }

  await ledgerService.appendEvent({
    sessionId: matchedSession.id,
    eventType: LedgerEventType.FiatDeposit,
    asset: deposit.currency,
    amount: deposit.amount,
    counterparty: 'bcb',
    referenceId: deposit.transactionId,
    metadata: { iban: deposit.iban, correlationId: deposit.correlationId },
  });

  const isOffRampFill =
    matchedSession.direction === SessionDirection.OffRamp &&
    matchedOrder &&
    matchedOrder.complianceStatus === ComplianceCheckpointStatus.Cleared &&
    (matchedOrder.status === OrderStatus.Submitted ||
      matchedOrder.status === OrderStatus.CompliancePending);

  if (isOffRampFill && matchedOrder) {
    const order = matchedOrder;
    await ordersRepo.updateStatus(order.id, OrderStatus.Filled);
    await sessionStateMachine.transition(
      matchedSession.id,
      SessionState.OrderFilled,
      'fiat_deposit_matched',
      { transaction_id: deposit.transactionId },
    );

    await webhookDispatcherService.dispatch(matchedSession.integratorId, {
      eventType: 'order_filled',
      sessionId: matchedSession.id,
      data: { order_id: order.id, fiat_amount: deposit.amount },
      timestamp: new Date(),
    });
  }

  await webhooksRepo.markProcessed(inboxId);
}

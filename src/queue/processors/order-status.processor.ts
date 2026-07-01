import { getRoutingAdapter } from '../../adapters/index.js';
import { LydiamRoutingAdapter } from '../../adapters/routing.adapter.js';
import { ordersRepo } from '../../db/repositories/orders.repo.js';
import { sessionsRepo } from '../../db/repositories/sessions.repo.js';
import { sessionStateMachine } from '../../services/session-state-machine.service.js';
import { webhookDispatcherService } from '../../services/webhook-dispatcher.service.js';
import {
  ComplianceCheckpointStatus,
  OrderStatus,
  SessionDirection,
  SessionState,
} from '../../types/index.js';

export interface OrderStatusPayload {
  providerOrderId: string;
}

export async function processOrderStatusUpdate(payload: OrderStatusPayload): Promise<void> {
  const order = await ordersRepo.findByProviderOrderId(payload.providerOrderId);
  if (!order || !order.providerOrderId) {
    return;
  }

  const routing = getRoutingAdapter();
  const status = await routing.getOrderStatus(order.providerOrderId);
  const session = await sessionsRepo.findById(order.sessionId);

  if (status.complianceStatus === 'cleared') {
    await ordersRepo.updateComplianceStatus(
      order.id,
      ComplianceCheckpointStatus.Cleared,
      OrderStatus.Submitted,
    );

    if (session) {
      await webhookDispatcherService.dispatch(session.integratorId, {
        eventType: 'status_change',
        sessionId: session.id,
        data: { order_id: order.id, compliance_status: 'cleared' },
        timestamp: new Date(),
      });
    }
  } else if (status.complianceStatus === 'rejected') {
    await ordersRepo.updateComplianceStatus(
      order.id,
      ComplianceCheckpointStatus.Rejected,
      OrderStatus.Failed,
    );
    await sessionStateMachine.transition(order.sessionId, SessionState.Failed, 'compliance_rejected');
  } else if (status.status === 'filled' && session?.direction === SessionDirection.OnRamp) {
    await ordersRepo.updateComplianceStatus(
      order.id,
      ComplianceCheckpointStatus.Cleared,
      OrderStatus.Filled,
    );
    await sessionStateMachine.transition(order.sessionId, SessionState.OrderFilled, 'order_filled');
  }
}

/** Test helper — simulate Lydiam clearing compliance for an order. */
export async function simulateComplianceCleared(providerOrderId: string): Promise<void> {
  LydiamRoutingAdapter.setOrderCleared(providerOrderId);
  await processOrderStatusUpdate({ providerOrderId });
}

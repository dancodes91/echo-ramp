import { getRoutingAdapter } from '../../adapters/index.js';
import { LydiamRoutingAdapter } from '../../adapters/routing.adapter.js';
import { ordersRepo } from '../../db/repositories/orders.repo.js';
import { sessionsRepo } from '../../db/repositories/sessions.repo.js';
import { webhookDispatcherService } from '../../services/webhook-dispatcher.service.js';
import {
  ComplianceCheckpointStatus,
  OrderStatus,
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

  if (status.complianceStatus === 'cleared') {
    await ordersRepo.updateComplianceStatus(
      order.id,
      ComplianceCheckpointStatus.Cleared,
      OrderStatus.Submitted,
    );

    const session = await sessionsRepo.findById(order.sessionId);
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
    await sessionsRepo.updateState(order.sessionId, SessionState.Failed);
  } else if (status.status === 'filled') {
    await ordersRepo.updateComplianceStatus(
      order.id,
      ComplianceCheckpointStatus.Cleared,
      OrderStatus.Filled,
    );
    await sessionsRepo.updateState(order.sessionId, SessionState.OrderFilled);
  }
}

/** Test helper — simulate Lydiam clearing compliance for an order. */
export async function simulateComplianceCleared(providerOrderId: string): Promise<void> {
  LydiamRoutingAdapter.setOrderCleared(providerOrderId);
  await processOrderStatusUpdate({ providerOrderId });
}

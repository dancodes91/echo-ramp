export interface OutboundWebhookPayload {
  eventType: string;
  sessionId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

const deliveryLog: OutboundWebhookPayload[] = [];

export class WebhookDispatcherService {
  async dispatch(integratorId: string, payload: OutboundWebhookPayload): Promise<void> {
    deliveryLog.push({ ...payload, data: { ...payload.data, integrator_id: integratorId } });
  }

  async enqueueDelivery(integratorId: string, payload: OutboundWebhookPayload): Promise<void> {
    await this.dispatch(integratorId, payload);
  }

  async processInboundWebhook(_provider: string, _payload: unknown): Promise<void> {
    // Inbound webhooks are processed by provider-specific routes
  }

  /** Test helper — inspect dispatched webhooks. */
  static getDeliveryLog(): OutboundWebhookPayload[] {
    return [...deliveryLog];
  }

  static clearDeliveryLog(): void {
    deliveryLog.length = 0;
  }
}

export const webhookDispatcherService = new WebhookDispatcherService();

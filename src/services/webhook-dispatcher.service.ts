export interface OutboundWebhookPayload {
  eventType: string;
  sessionId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export class WebhookDispatcherService {
  async dispatch(_integratorId: string, _payload: OutboundWebhookPayload): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async enqueueDelivery(_integratorId: string, _payload: OutboundWebhookPayload): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async processInboundWebhook(_provider: string, _payload: unknown): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const webhookDispatcherService = new WebhookDispatcherService();

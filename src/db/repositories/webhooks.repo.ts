export class WebhooksRepository {
  async storeInbound(_provider: string, _payload: unknown): Promise<{ id: string }> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async markProcessed(_id: string): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const webhooksRepo = new WebhooksRepository();

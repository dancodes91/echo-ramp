import { IntegratorAccount, IntegratorStatus } from '../types/index.js';
import { query } from '../client.js';

export class IntegratorsRepository {
  async findById(_id: string): Promise<IntegratorAccount | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async findByApiKeyHash(_apiKeyHash: string): Promise<IntegratorAccount | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async create(_input: {
    name: string;
    apiKeyHash: string;
    apiSecretEncrypted: string;
    revenueShareBps: number;
    status?: IntegratorStatus;
  }): Promise<IntegratorAccount> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  /** Health check — verifies DB connectivity */
  async ping(): Promise<boolean> {
    await query('SELECT 1');
    return true;
  }
}

export const integratorsRepo = new IntegratorsRepository();

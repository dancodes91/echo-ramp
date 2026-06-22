import { IntegratorAccount, IntegratorStatus } from '../../types/index.js';
import { query } from '../client.js';
import { mapIntegrator, mapIntegratorWithSecret } from '../mappers.js';

export class IntegratorsRepository {
  async findById(id: string): Promise<IntegratorAccount | null> {
    const result = await query('SELECT * FROM integrator_accounts WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapIntegrator(result.rows[0]);
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<(IntegratorAccount & { apiSecret: string }) | null> {
    const result = await query(
      'SELECT * FROM integrator_accounts WHERE api_key_hash = $1 AND status = $2',
      [apiKeyHash, IntegratorStatus.Active],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapIntegratorWithSecret(result.rows[0]);
  }

  async create(input: {
    name: string;
    apiKeyHash: string;
    apiSecretEncrypted: string;
    revenueShareBps: number;
    status?: IntegratorStatus;
  }): Promise<IntegratorAccount> {
    const result = await query(
      `INSERT INTO integrator_accounts (name, api_key_hash, api_secret_encrypted, revenue_share_bps, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.name,
        input.apiKeyHash,
        input.apiSecretEncrypted,
        input.revenueShareBps,
        input.status ?? IntegratorStatus.Active,
      ],
    );
    return mapIntegrator(result.rows[0]);
  }

  async ping(): Promise<boolean> {
    await query('SELECT 1');
    return true;
  }
}

export const integratorsRepo = new IntegratorsRepository();

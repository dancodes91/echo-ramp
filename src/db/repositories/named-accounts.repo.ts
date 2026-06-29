import { NamedAccountStatus, NamedFiatAccount } from '../../types/index.js';
import { query } from '../client.js';
import { mapNamedFiatAccount } from '../mappers.js';

export class NamedAccountsRepository {
  async create(input: {
    userId: string;
    accountIdentifier: string;
    currency: string;
    provider?: string;
    bcbCorrelationId: string;
    status?: NamedAccountStatus;
  }): Promise<NamedFiatAccount> {
    const result = await query(
      `INSERT INTO user_named_fiat_accounts (
         user_id, account_identifier, currency, provider, bcb_correlation_id, status
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.userId,
        input.accountIdentifier,
        input.currency,
        input.provider ?? 'bcb',
        input.bcbCorrelationId,
        input.status ?? NamedAccountStatus.Pending,
      ],
    );
    return mapNamedFiatAccount(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<NamedFiatAccount | null> {
    const result = await query(
      `SELECT * FROM user_named_fiat_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapNamedFiatAccount(result.rows[0]);
  }

  async findByAccountIdentifier(accountIdentifier: string): Promise<NamedFiatAccount | null> {
    const result = await query(
      `SELECT * FROM user_named_fiat_accounts WHERE account_identifier = $1`,
      [accountIdentifier],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapNamedFiatAccount(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: NamedAccountStatus,
    accountIdentifier?: string,
  ): Promise<NamedFiatAccount> {
    const result = await query(
      `UPDATE user_named_fiat_accounts
       SET status = $2,
           account_identifier = COALESCE($3, account_identifier),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, accountIdentifier ?? null],
    );
    if (result.rowCount === 0) {
      throw new Error(`Named account not found: ${id}`);
    }
    return mapNamedFiatAccount(result.rows[0]);
  }
}

export const namedAccountsRepo = new NamedAccountsRepository();

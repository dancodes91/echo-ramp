import { EndUser, EndUserStatus } from '../../types/index.js';
import { query } from '../client.js';
import { mapEndUser } from '../mappers.js';

export class UsersRepository {
  async findById(id: string): Promise<EndUser | null> {
    const result = await query('SELECT * FROM end_users WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapEndUser(result.rows[0]);
  }

  async findByIntegratorUserId(
    integratorId: string,
    integratorUserId: string,
  ): Promise<EndUser | null> {
    const result = await query(
      'SELECT * FROM end_users WHERE integrator_id = $1 AND integrator_user_id = $2',
      [integratorId, integratorUserId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapEndUser(result.rows[0]);
  }

  async upsert(input: {
    integratorId: string;
    integratorUserId: string;
    status?: EndUserStatus;
  }): Promise<EndUser> {
    const result = await query(
      `INSERT INTO end_users (integrator_id, integrator_user_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (integrator_id, integrator_user_id)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [input.integratorId, input.integratorUserId, input.status ?? EndUserStatus.Active],
    );
    return mapEndUser(result.rows[0]);
  }
}

export const usersRepo = new UsersRepository();

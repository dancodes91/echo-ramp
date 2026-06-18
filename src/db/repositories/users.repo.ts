import { EndUser, EndUserStatus } from '../../types/index.js';

export class UsersRepository {
  async findById(_id: string): Promise<EndUser | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async findByIntegratorUserId(
    _integratorId: string,
    _integratorUserId: string,
  ): Promise<EndUser | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async upsert(_input: {
    integratorId: string;
    integratorUserId: string;
    status?: EndUserStatus;
  }): Promise<EndUser> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const usersRepo = new UsersRepository();

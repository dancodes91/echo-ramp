import { EchoTransfer } from '../../types/index.js';

export class TransfersRepository {
  async findById(_id: string): Promise<EchoTransfer | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async create(_input: Omit<EchoTransfer, 'id' | 'createdAt' | 'updatedAt'>): Promise<EchoTransfer> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const transfersRepo = new TransfersRepository();

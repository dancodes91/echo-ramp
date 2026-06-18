import { AdapterError, NOT_IMPLEMENTED } from './adapter.types.js';
import { ScreeningStatus } from '../types/index.js';

export class ChainalysisAdapter {
  async screenAddress(_address: string, _chain: string): Promise<{ status: ScreeningStatus }> {
    throw new AdapterError(NOT_IMPLEMENTED, 'chainalysis');
  }

  async screenTransaction(_txHash: string, _chain: string): Promise<{ status: ScreeningStatus }> {
    throw new AdapterError(NOT_IMPLEMENTED, 'chainalysis');
  }
}

import { AdapterError, NOT_IMPLEMENTED } from './adapter.types.js';
import { KycLevel } from '../types/index.js';

export class SumsubAdapter {
  async createApplicant(_userId: string, _level: KycLevel): Promise<{ applicantId: string; accessToken: string }> {
    throw new AdapterError(NOT_IMPLEMENTED, 'sumsub');
  }

  async getApplicantStatus(_applicantId: string): Promise<{ status: string; level: KycLevel }> {
    throw new AdapterError(NOT_IMPLEMENTED, 'sumsub');
  }
}

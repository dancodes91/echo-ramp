import { KycLevel, KycStatus, ScreeningStatus } from '../types/index.js';

export interface KycRecord {
  userId: string;
  level: KycLevel;
  status: KycStatus;
  sumsubApplicantId: string | null;
}

export class ComplianceService {
  async initiateKyc(_userId: string, _level: KycLevel): Promise<{ accessToken: string; applicantId: string }> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async getKycStatus(_userId: string): Promise<KycRecord | null> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async screenWallet(_address: string, _chain: string): Promise<ScreeningStatus> {
    throw new Error('Not implemented — Phase 0 stub');
  }

  async handleKycWebhook(_payload: unknown): Promise<void> {
    throw new Error('Not implemented — Phase 0 stub');
  }
}

export const complianceService = new ComplianceService();

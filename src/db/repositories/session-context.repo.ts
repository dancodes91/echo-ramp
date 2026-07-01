import { query } from '../client.js';

export interface UserSessionContextFlags {
  kycApproved: boolean;
  complianceSubmissionApproved: boolean;
  namedAccountActive: boolean;
  hasWallet: boolean;
  hasBankLink: boolean;
}

export class SessionContextRepository {
  async loadUserFlags(userId: string): Promise<UserSessionContextFlags> {
    const [kycResult, submissionResult, namedAccountResult, walletResult] =
      await Promise.all([
        query<{ status: string }>(
          `SELECT status FROM sumsub_kyc_profiles WHERE user_id = $1 LIMIT 1`,
          [userId],
        ),
        query<{ status: string }>(
          `SELECT status FROM compliance_submissions
           WHERE user_id = $1
           ORDER BY submitted_at DESC
           LIMIT 1`,
          [userId],
        ),
        query<{ status: string }>(
          `SELECT status FROM user_named_fiat_accounts WHERE user_id = $1 LIMIT 1`,
          [userId],
        ),
        query<{ exists: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM user_wallets WHERE user_id = $1) AS exists`,
          [userId],
        ),
      ]);

    const kycStatus = kycResult.rows[0]?.status;
    const submissionStatus = submissionResult.rows[0]?.status;
    const namedAccountStatus = namedAccountResult.rows[0]?.status;

    return {
      kycApproved: kycStatus === 'approved',
      complianceSubmissionApproved: submissionStatus === 'approved',
      namedAccountActive: namedAccountStatus === 'active',
      hasWallet: walletResult.rows[0]?.exists ?? false,
      hasBankLink: false,
    };
  }
}

export const sessionContextRepo = new SessionContextRepository();

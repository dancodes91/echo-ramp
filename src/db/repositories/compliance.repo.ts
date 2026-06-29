import { CompliancePack } from '../../adapters/adapter.types.js';
import {
  CompliancePackRecord,
  ComplianceSubmission,
  ComplianceSubmissionStatus,
  KycLevel,
  KycStatus,
} from '../../types/index.js';
import { query } from '../client.js';
import {
  mapCompliancePack,
  mapComplianceSubmission,
  mapKycProfile,
  type KycProfile,
} from '../mappers.js';

export type { KycProfile };

export class ComplianceRepository {
  async findKycProfileByUserId(userId: string): Promise<KycProfile | null> {
    const result = await query('SELECT * FROM sumsub_kyc_profiles WHERE user_id = $1', [userId]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapKycProfile(result.rows[0]);
  }

  async upsertKycProfile(input: {
    userId: string;
    sumsubApplicantId: string;
    level?: KycLevel;
    status: KycStatus;
    rawSnapshot?: Record<string, unknown>;
  }): Promise<KycProfile> {
    const result = await query(
      `INSERT INTO sumsub_kyc_profiles (user_id, sumsub_applicant_id, level, status, raw_snapshot)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         sumsub_applicant_id = EXCLUDED.sumsub_applicant_id,
         level = EXCLUDED.level,
         status = EXCLUDED.status,
         raw_snapshot = EXCLUDED.raw_snapshot,
         updated_at = NOW()
       RETURNING *`,
      [
        input.userId,
        input.sumsubApplicantId,
        input.level ?? KycLevel.Basic,
        input.status,
        JSON.stringify(input.rawSnapshot ?? {}),
      ],
    );
    return mapKycProfile(result.rows[0]);
  }

  async createPack(userId: string, pack: CompliancePack, version = 1): Promise<CompliancePackRecord> {
    const result = await query(
      `INSERT INTO compliance_packs (user_id, pack, version) VALUES ($1, $2, $3) RETURNING *`,
      [userId, JSON.stringify(pack), version],
    );
    return mapCompliancePack(result.rows[0]);
  }

  async findLatestPackByUserId(userId: string): Promise<CompliancePackRecord | null> {
    const result = await query(
      `SELECT * FROM compliance_packs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapCompliancePack(result.rows[0]);
  }

  async createSubmission(input: {
    packId: string;
    userId: string;
    partner: string;
    externalRef: string | null;
    status: ComplianceSubmissionStatus;
  }): Promise<ComplianceSubmission> {
    const result = await query(
      `INSERT INTO compliance_submissions (pack_id, user_id, partner, external_ref, status, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.packId,
        input.userId,
        input.partner,
        input.externalRef,
        input.status,
        input.status === ComplianceSubmissionStatus.Pending ? null : new Date(),
      ],
    );
    return mapComplianceSubmission(result.rows[0]);
  }

  async updateSubmissionStatus(
    id: string,
    status: ComplianceSubmissionStatus,
    externalRef?: string | null,
  ): Promise<ComplianceSubmission> {
    const result = await query(
      `UPDATE compliance_submissions
       SET status = $2,
           external_ref = COALESCE($3, external_ref),
           resolved_at = CASE WHEN $2 IN ('approved', 'rejected') THEN NOW() ELSE resolved_at END
       WHERE id = $1
       RETURNING *`,
      [id, status, externalRef ?? null],
    );
    if (result.rowCount === 0) {
      throw new Error(`Compliance submission not found: ${id}`);
    }
    return mapComplianceSubmission(result.rows[0]);
  }

  async findLatestSubmissionByUserId(userId: string): Promise<ComplianceSubmission | null> {
    const result = await query(
      `SELECT * FROM compliance_submissions WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
      [userId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapComplianceSubmission(result.rows[0]);
  }
}

export const complianceRepo = new ComplianceRepository();

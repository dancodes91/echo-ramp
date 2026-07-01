import { CompliancePack } from '../adapters/adapter.types.js';
import { getComplianceHandoffAdapter } from '../adapters/index.js';
import { getFiatRailsAdapter } from '../adapters/index.js';
import { complianceRepo } from '../db/repositories/compliance.repo.js';
import { namedAccountsRepo } from '../db/repositories/named-accounts.repo.js';
import { sessionStateMachine } from './session-state-machine.service.js';
import {
  ComplianceSubmissionStatus,
  KycLevel,
  KycStatus,
  NamedAccountStatus,
  SessionState,
} from '../types/index.js';

export interface KycRecord {
  userId: string;
  level: KycLevel;
  status: KycStatus;
  sumsubApplicantId: string | null;
}

export class ComplianceService {
  async initiateKyc(_userId: string, _level: KycLevel): Promise<{ accessToken: string; applicantId: string }> {
    throw new Error('Not implemented — awaiting Sumsub sandbox credentials');
  }

  async getKycStatus(userId: string): Promise<KycRecord | null> {
    const profile = await complianceRepo.findKycProfileByUserId(userId);
    if (!profile) {
      return null;
    }
    return {
      userId: profile.userId,
      level: profile.level,
      status: profile.status,
      sumsubApplicantId: profile.sumsubApplicantId,
    };
  }

  async buildCompliancePack(userId: string): Promise<CompliancePack> {
    const profile = await complianceRepo.findKycProfileByUserId(userId);
    if (!profile || profile.status !== KycStatus.Approved) {
      throw new ComplianceError('kyc_not_approved', 'KYC must be approved before building compliance pack', 422);
    }

    const snapshot = profile.rawSnapshot;
    const fixedInfo = (snapshot.fixedInfo ?? snapshot.info ?? {}) as Record<string, string>;

    return {
      userId,
      sumsubApplicantId: profile.sumsubApplicantId,
      firstName: fixedInfo.firstName ?? snapshot.firstName ?? 'Unknown',
      lastName: fixedInfo.lastName ?? snapshot.lastName ?? 'Unknown',
      dateOfBirth: fixedInfo.dob ?? snapshot.dob ?? '1970-01-01',
      nationality: fixedInfo.nationality ?? snapshot.nationality ?? 'US',
      addressLine1: fixedInfo.addressLine1 ?? snapshot.addressLine1 ?? '',
      city: fixedInfo.city ?? snapshot.city ?? '',
      postcode: fixedInfo.postcode ?? snapshot.postcode ?? '',
      country: fixedInfo.country ?? snapshot.country ?? 'US',
      documentType: snapshot.documentType as string | undefined,
    };
  }

  async submitToPartner(userId: string, partner = 'lydiam'): Promise<{
    packId: string;
    submissionId: string;
    status: ComplianceSubmissionStatus;
  }> {
    const pack = await this.buildCompliancePack(userId);
    const packRecord = await complianceRepo.createPack(userId, pack);

    const adapter = getComplianceHandoffAdapter(partner);
    const result = await adapter.submitPack(pack);

    const submission = await complianceRepo.createSubmission({
      packId: packRecord.id,
      userId,
      partner: result.partner,
      externalRef: result.externalRef,
      status: result.status as ComplianceSubmissionStatus,
    });

    await sessionStateMachine.transitionEligibleSessionsForUser(
      userId,
      SessionState.ComplianceHandoffPending,
      'compliance_pack_submitted',
      (s) => s.state === SessionState.KycOk,
    );

    if (result.status === 'approved') {
      await complianceRepo.updateSubmissionStatus(submission.id, ComplianceSubmissionStatus.Approved);
      await sessionStateMachine.transitionEligibleSessionsForUser(
        userId,
        SessionState.ComplianceHandoffOk,
        'compliance_partner_approved',
        (s) => s.state === SessionState.ComplianceHandoffPending,
      );
      await this.provisionNamedAccountIfNeeded(userId, pack);
    }

    return {
      packId: packRecord.id,
      submissionId: submission.id,
      status: result.status as ComplianceSubmissionStatus,
    };
  }

  async provisionNamedAccountIfNeeded(userId: string, pack: CompliancePack): Promise<void> {
    const existing = await namedAccountsRepo.findByUserId(userId);
    if (existing?.status === NamedAccountStatus.Active) {
      await sessionStateMachine.transitionEligibleSessionsForUser(
        userId,
        SessionState.BankLinkRequired,
        'named_account_active',
        (s) => s.state === SessionState.NamedAccountPending,
      );
      return;
    }

    await sessionStateMachine.transitionEligibleSessionsForUser(
      userId,
      SessionState.NamedAccountPending,
      'named_account_provision_started',
      (s) => s.state === SessionState.ComplianceHandoffOk,
    );

    const correlationId = `echo-${userId.slice(0, 8)}`;
    const fiatAdapter = getFiatRailsAdapter();

    try {
      const result = await fiatAdapter.provisionNamedAccount({
        userId,
        currency: 'USD',
        correlationId,
        name: `${pack.firstName} ${pack.lastName}`,
        dateOfBirth: pack.dateOfBirth,
        addressLine1: pack.addressLine1,
        city: pack.city,
        postcode: pack.postcode,
        country: pack.country,
        nationality: pack.nationality,
      });

      if (existing) {
        await namedAccountsRepo.updateStatus(
          existing.id,
          result.status === 'active' ? NamedAccountStatus.Active : NamedAccountStatus.Pending,
          result.accountIdentifier || undefined,
        );
      } else {
        await namedAccountsRepo.create({
          userId,
          accountIdentifier: result.accountIdentifier,
          currency: result.currency,
          bcbCorrelationId: result.correlationId,
          status: result.status === 'active' ? NamedAccountStatus.Active : NamedAccountStatus.Pending,
        });
      }

      if (result.status === 'active') {
        await sessionStateMachine.transitionEligibleSessionsForUser(
          userId,
          SessionState.BankLinkRequired,
          'named_account_active',
          (s) => s.state === SessionState.NamedAccountPending,
        );
      }
    } catch {
      // BCB credentials not configured — remain in named_account_pending
    }
  }

  async handleKycWebhook(payload: unknown): Promise<void> {
    const body = payload as {
      type?: string;
      applicantId?: string;
      externalUserId?: string;
      reviewResult?: { reviewAnswer?: string };
      applicant?: { id?: string; externalUserId?: string };
    };

    if (body.type !== 'applicantReviewed' && body.type !== 'applicantWorkflowCompleted') {
      return;
    }

    const reviewAnswer = body.reviewResult?.reviewAnswer;
    if (reviewAnswer !== 'GREEN') {
      return;
    }

    const userId = body.externalUserId ?? body.applicant?.externalUserId;
    const applicantId = body.applicantId ?? body.applicant?.id;

    if (!userId || !applicantId) {
      throw new ComplianceError('invalid_webhook', 'Missing userId or applicantId in Sumsub webhook', 400);
    }

    await complianceRepo.upsertKycProfile({
      userId,
      sumsubApplicantId: applicantId,
      status: KycStatus.Approved,
      rawSnapshot: body as Record<string, unknown>,
    });

    await sessionStateMachine.transitionEligibleSessionsForUser(
      userId,
      SessionState.KycOk,
      'kyc_webhook_approved',
      (s) => s.state === SessionState.KycRequired,
    );
    await this.submitToPartner(userId);
  }
}

export class ComplianceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ComplianceError';
  }
}

export const complianceService = new ComplianceService();

import { randomUUID } from 'node:crypto';

import { config } from '../config/index.js';
import {
  AdapterError,
  ComplianceHandoffAdapter,
  CompliancePack,
  ComplianceSubmissionResult,
  NOT_IMPLEMENTED,
} from './adapter.types.js';

const submissionStore = new Map<string, ComplianceSubmissionResult>();

export class LydiamComplianceAdapter implements ComplianceHandoffAdapter {
  readonly partner = 'lydiam';

  async submitPack(_pack: CompliancePack): Promise<ComplianceSubmissionResult> {
    if (!config.LYDIAM_API_BASE_URL && config.NODE_ENV !== 'test') {
      throw new AdapterError(NOT_IMPLEMENTED, this.partner);
    }

    const submissionId = randomUUID();
    const result: ComplianceSubmissionResult = {
      submissionId,
      partner: this.partner,
      externalRef: `lydiam-stub-${submissionId.slice(0, 8)}`,
      status: config.NODE_ENV === 'test' ? 'approved' : 'pending',
    };
    submissionStore.set(submissionId, result);
    return result;
  }

  async getSubmissionStatus(submissionId: string): Promise<ComplianceSubmissionResult> {
    const stored = submissionStore.get(submissionId);
    if (!stored) {
      throw new AdapterError('Submission not found', this.partner, 'not_found', 404);
    }
    return stored;
  }

  static approveForTest(submissionId: string): void {
    const stored = submissionStore.get(submissionId);
    if (stored) {
      submissionStore.set(submissionId, { ...stored, status: 'approved' });
    }
  }

  static clearTestStore(): void {
    submissionStore.clear();
  }
}

const partnerRegistry = new Map<string, ComplianceHandoffAdapter>([
  ['lydiam', new LydiamComplianceAdapter()],
]);

export function getComplianceHandoffAdapter(partner = 'lydiam'): ComplianceHandoffAdapter {
  const adapter = partnerRegistry.get(partner);
  if (!adapter) {
    throw new AdapterError(`Unknown compliance partner: ${partner}`, 'compliance_handoff');
  }
  return adapter;
}

export function registerCompliancePartner(adapter: ComplianceHandoffAdapter): void {
  partnerRegistry.set(adapter.partner, adapter);
}

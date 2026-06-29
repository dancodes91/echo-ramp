import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

function w(path, content) {
  writeFileSync(path, content.replace(/\r?\n/g, '\n'), 'utf8');
  console.log('wrote', path);
}

w('src/adapters/compliance-handoff.adapter.ts', `import { randomUUID } from 'node:crypto';

import { config } from '../config/index.js';
import {
  AdapterError,
  ComplianceHandoffAdapter,
  CompliancePack,
  ComplianceSubmissionResult,
  NOT_IMPLEMENTED,
} from './adapter.types.js';

const submissionStore = new Map();

export class LydiamComplianceAdapter {
  constructor() {
    this.partner = 'lydiam';
  }

  async submitPack(pack) {
    if (!config.LYDIAM_API_BASE_URL && config.NODE_ENV !== 'test') {
      throw new AdapterError(NOT_IMPLEMENTED, this.partner);
    }

    const submissionId = randomUUID();
    const result = {
      submissionId,
      partner: this.partner,
      externalRef: \`lydiam-stub-\${submissionId.slice(0, 8)}\`,
      status: config.NODE_ENV === 'test' ? 'approved' : 'pending',
    };
    submissionStore.set(submissionId, result);
    return result;
  }

  async getSubmissionStatus(submissionId) {
    const stored = submissionStore.get(submissionId);
    if (!stored) {
      throw new AdapterError('Submission not found', this.partner, 'not_found', 404);
    }
    return stored;
  }

  static approveForTest(submissionId) {
    const stored = submissionStore.get(submissionId);
    if (stored) {
      submissionStore.set(submissionId, { ...stored, status: 'approved' });
    }
  }

  static clearTestStore() {
    submissionStore.clear();
  }
}

const partnerRegistry = new Map([['lydiam', new LydiamComplianceAdapter()]]);

export function getComplianceHandoffAdapter(partner = 'lydiam') {
  const adapter = partnerRegistry.get(partner);
  if (!adapter) {
    throw new AdapterError(\`Unknown compliance partner: \${partner}\`, 'compliance_handoff');
  }
  return adapter;
}

export function registerCompliancePartner(adapter) {
  partnerRegistry.set(adapter.partner, adapter);
}
`);

console.log('partial script - run full upgrade separately');

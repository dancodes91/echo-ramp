import { SessionState } from '../types/index.js';

export class SessionStateError extends Error {
  constructor(
    public readonly code: 'invalid_transition' | 'session_not_found' | 'prerequisite_missing',
    message: string,
    public readonly statusCode: number,
    public readonly details?: {
      from: SessionState;
      to: SessionState;
      missing?: string[];
    },
  ) {
    super(message);
    this.name = 'SessionStateError';
  }
}

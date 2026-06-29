import { createHmac, timingSafeEqual } from 'node:crypto';

import { config } from '../config/index.js';
import {
  AdapterError,
  FiatRailsAdapter,
  NOT_IMPLEMENTED,
  VirtualAccountProvisionInput,
} from './adapter.types.js';

interface BcbTokenCache {
  accessToken: string;
  expiresAt: number;
}

export class BcbAdapter implements FiatRailsAdapter {
  readonly provider = 'bcb' as const;

  private tokenCache: BcbTokenCache | null = null;

  private async getAccessToken(): Promise<string> {
    if (!config.BCB_CLIENT_ID || !config.BCB_CLIENT_SECRET) {
      throw new AdapterError(NOT_IMPLEMENTED, this.provider, 'missing_credentials');
    }

    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.accessToken;
    }

    const response = await fetch(`${config.BCB_BASE_URL}/v1/auth/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.BCB_CLIENT_ID,
        client_secret: config.BCB_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      throw new AdapterError(
        `BCB auth failed: ${response.status}`,
        this.provider,
        'auth_failed',
        response.status,
      );
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      accessToken: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return body.access_token;
  }

  async provisionNamedAccount(input: VirtualAccountProvisionInput) {
    if (!config.BCB_ACCOUNT_ID) {
      throw new AdapterError(NOT_IMPLEMENTED, this.provider, 'missing_account_id');
    }

    const token = await this.getAccessToken();
    const response = await fetch(
      `${config.BCB_BASE_URL}/v2/accounts/${config.BCB_ACCOUNT_ID}/virtual`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correlationId: input.correlationId,
          name: input.name,
          isIndividual: true,
          dateOfBirth: input.dateOfBirth,
          addressLine1: input.addressLine1,
          city: input.city,
          postcode: input.postcode,
          country: input.country,
          nationality: input.nationality,
        }),
      },
    );

    if (response.status === 202) {
      return {
        accountIdentifier: '',
        currency: input.currency,
        correlationId: input.correlationId,
        status: 'pending' as const,
      };
    }

    if (!response.ok) {
      throw new AdapterError(
        `BCB VA create failed: ${response.status}`,
        this.provider,
        'va_create_failed',
        response.status,
      );
    }

    const body = (await response.json()) as { iban?: string };
    return {
      accountIdentifier: body.iban ?? '',
      currency: input.currency,
      correlationId: input.correlationId,
      status: (body.iban ? 'active' : 'pending') as 'pending' | 'active',
    };
  }

  async getAccountDetails(accountIdentifier: string) {
    if (!config.BCB_ACCOUNT_ID) {
      throw new AdapterError(NOT_IMPLEMENTED, this.provider, 'missing_account_id');
    }

    const token = await this.getAccessToken();
    const response = await fetch(
      `${config.BCB_BASE_URL}/v2/accounts/${config.BCB_ACCOUNT_ID}/virtual`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      throw new AdapterError(
        `BCB list VA failed: ${response.status}`,
        this.provider,
        'va_list_failed',
        response.status,
      );
    }

    const accounts = (await response.json()) as Array<{ iban: string; currency: string }>;
    const match = accounts.find((a) => a.iban === accountIdentifier);
    if (!match) {
      throw new AdapterError('Virtual account not found', this.provider, 'not_found', 404);
    }

    return { accountIdentifier: match.iban, currency: match.currency, status: 'active' };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!config.BCB_WEBHOOK_SECRET || !signature) {
      return config.NODE_ENV === 'test';
    }

    const expected = createHmac('sha256', config.BCB_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  async handleFiatReceiptWebhook(payload: unknown, signature: string | undefined) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);

    if (!this.verifyWebhookSignature(raw, signature)) {
      throw new AdapterError('Invalid BCB webhook signature', this.provider, 'invalid_signature', 401);
    }

    const body = (typeof payload === 'object' && payload !== null ? payload : JSON.parse(raw)) as {
      transactions?: Array<{
        id: string;
        amount_actual: number;
        currency: string;
        credit: boolean;
        iban: string;
        reference?: string;
      }>;
    };

    const credit = body.transactions?.find((t) => t.credit);
    if (!credit) {
      throw new AdapterError('No credit transaction in webhook', this.provider, 'no_credit');
    }

    return {
      iban: credit.iban,
      amount: String(credit.amount_actual),
      currency: credit.currency,
      correlationId: credit.reference,
      transactionId: credit.id,
    };
  }
}

let bcbInstance: BcbAdapter | null = null;

export function getBcbAdapter(): BcbAdapter {
  if (!bcbInstance) {
    bcbInstance = new BcbAdapter();
  }
  return bcbInstance;
}

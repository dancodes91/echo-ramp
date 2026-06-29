import { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Non-custody invariant: Echo must never initiate outbound money movement
 * on its own authority. All bank payouts and crypto sends are user-authenticated.
 */
const MONEY_MOVEMENT_PATHS = [
  '/v1/client/orders',
  '/v1/client/bank',
  '/v1/client/transfers',
];

const BCB_PAYMENT_ACTIONS = new Set([
  'initiate_bcb_payment',
  'bcb_payment',
  'bcb_va_payment',
]);

function isMoneyMovementRoute(url: string): boolean {
  return MONEY_MOVEMENT_PATHS.some((prefix) => url.startsWith(prefix));
}

function bodyDeclaresEchoExecution(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const record = body as Record<string, unknown>;

  if (record.executed_by === 'echo' || record.executedBy === 'echo') {
    return true;
  }

  return false;
}

function bodyAttemptsBcbPaymentWithoutUserAuth(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const record = body as Record<string, unknown>;
  const action = record.action ?? record.type ?? record.operation;

  if (typeof action === 'string' && BCB_PAYMENT_ACTIONS.has(action)) {
    const executedBy = record.executed_by ?? record.executedBy;
    return executedBy !== 'user';
  }

  return false;
}

export function registerNonCustodyGuard(app: FastifyInstance): void {
  app.addHook('preValidation', async (request: FastifyRequest) => {
    const url = request.url.split('?')[0] ?? request.url;

    if (!isMoneyMovementRoute(url)) {
      return;
    }

    if (bodyDeclaresEchoExecution(request.body)) {
      const error = new Error(
        'Non-custody violation: Echo cannot execute outbound money movements. ' +
          'All transfers must be user-authenticated (executed_by: user).',
      );
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    if (bodyAttemptsBcbPaymentWithoutUserAuth(request.body)) {
      const error = new Error(
        'Non-custody violation: BCB virtual account payments require user authentication ' +
          '(executed_by: user). Echo cannot initiate BCB payouts.',
      );
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }
  });

  app.log.info('Non-custody guard registered — Echo-initiated outbound movements blocked');
}

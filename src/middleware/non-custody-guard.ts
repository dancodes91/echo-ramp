import { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Non-custody invariant: Echo must never initiate outbound money movement
 * on its own authority. All bank payouts and crypto sends are user-authenticated.
 *
 * This hook inspects request bodies on money-movement endpoints and rejects
 * any payload that declares executed_by: 'echo'.
 */
const MONEY_MOVEMENT_PATHS = [
  '/v1/client/orders',
  '/v1/client/bank',
  '/v1/client/transfers',
];

function isMoneyMovementRoute(url: string): boolean {
  return MONEY_MOVEMENT_PATHS.some((prefix) => url.startsWith(prefix));
}

function bodyDeclaresEchoExecution(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const record = body as Record<string, unknown>;

  if (record.executed_by === 'echo') {
    return true;
  }

  if (record.executedBy === 'echo') {
    return true;
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
  });

  app.log.info('Non-custody guard registered — Echo-initiated outbound movements blocked');
}

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { getBcbAdapter } from '../../adapters/bcb.adapter.js';
import { webhooksRepo } from '../../db/repositories/webhooks.repo.js';
import { processBcbDeposit } from '../../queue/processors/bcb-deposit.processor.js';

export class BcbWebhookError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'BcbWebhookError';
  }
}

export async function handleBcbWebhook(
  rawBody: string,
  payload: unknown,
  signature: string | undefined,
): Promise<{ inboxId: string }> {
  const bcb = getBcbAdapter();
  const signatureVerified = bcb.verifyWebhookSignature(rawBody, signature);

  const inbox = await webhooksRepo.storeInbound('bcb', payload, signatureVerified);

  if (!signatureVerified) {
    throw new BcbWebhookError('invalid_signature', 'Invalid BCB webhook signature', 401);
  }

  const deposit = await bcb.handleFiatReceiptWebhook(payload, signature);
  await processBcbDeposit(deposit, inbox.id);

  return { inboxId: inbox.id };
}

export const bcbWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (request, reply) => {
    try {
      const signature = request.headers['x-bcb-signature'] as string | undefined;
      const rawBody = request.rawBody ?? JSON.stringify(request.body);
      const result = await handleBcbWebhook(rawBody, request.body, signature);
      return reply.status(202).send({ received: true, inbox_id: result.inboxId });
    } catch (err) {
      if (err instanceof BcbWebhookError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
};

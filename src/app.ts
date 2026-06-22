import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { config } from './config/index.js';
import { registerAuthMiddleware, registerRawBodyParser } from './middleware/auth.js';
import { registerIdempotencyMiddleware } from './middleware/idempotency.js';
import { registerNonCustodyGuard } from './middleware/non-custody-guard.js';

import { serverSessionRoutes } from './api/server/sessions.js';
import { serverUserRoutes } from './api/server/users.js';
import { serverWebhookRoutes } from './api/server/webhooks.js';

import { clientSessionRoutes } from './api/client/session.js';
import { clientKycRoutes } from './api/client/kyc.js';
import { clientWalletRoutes } from './api/client/wallets.js';
import { clientBankRoutes } from './api/client/bank.js';
import { clientQuoteRoutes } from './api/client/quotes.js';
import { clientOrderRoutes } from './api/client/orders.js';
import { clientTransferRoutes } from './api/client/transfers.js';

import { sumsubWebhookRoutes } from './api/webhooks/sumsub.js';
import { bvnkWebhookRoutes } from './api/webhooks/bvnk.js';
import { bankAggregatorWebhookRoutes } from './api/webhooks/bank-aggregator.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  registerRawBodyParser(app);
  registerNonCustodyGuard(app);
  registerAuthMiddleware(app);
  registerIdempotencyMiddleware(app);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'echo-ramp',
    env: config.NODE_ENV,
  }));

  await app.register(serverSessionRoutes, { prefix: '/v1/server/sessions' });
  await app.register(serverUserRoutes, { prefix: '/v1/server/users' });
  await app.register(serverWebhookRoutes, { prefix: '/v1/server/webhooks' });

  await app.register(clientSessionRoutes, { prefix: '/v1/client/session' });
  await app.register(clientKycRoutes, { prefix: '/v1/client/kyc' });
  await app.register(clientWalletRoutes, { prefix: '/v1/client/wallets' });
  await app.register(clientBankRoutes, { prefix: '/v1/client/bank' });
  await app.register(clientQuoteRoutes, { prefix: '/v1/client/quotes' });
  await app.register(clientOrderRoutes, { prefix: '/v1/client/orders' });
  await app.register(clientTransferRoutes, { prefix: '/v1/client/transfers' });

  await app.register(sumsubWebhookRoutes, { prefix: '/v1/webhooks/sumsub' });
  await app.register(bvnkWebhookRoutes, { prefix: '/v1/webhooks/bvnk' });
  await app.register(bankAggregatorWebhookRoutes, { prefix: '/v1/webhooks/bank-aggregator' });

  return app;
}

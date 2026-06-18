import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientWalletRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Register wallet — Phase 0 stub' },
    });
  });

  app.get('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'List wallets — Phase 0 stub' },
    });
  });
};

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientTransferRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Initiate wallet-to-wallet transfer — Phase 0 stub' },
    });
  });

  app.get('/:transferId', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Get transfer status — Phase 0 stub' },
    });
  });
};

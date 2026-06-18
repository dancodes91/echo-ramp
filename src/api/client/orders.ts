import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientOrderRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Submit order — Phase 0 stub' },
    });
  });

  app.get('/:orderId', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Get order — Phase 0 stub' },
    });
  });

  app.post('/:orderId/bank-payout', async (_request, reply) => {
    return reply.status(501).send({
      error: {
        code: 'not_implemented',
        message: 'User-authenticated bank payout session — Phase 0 stub',
      },
    });
  });
};

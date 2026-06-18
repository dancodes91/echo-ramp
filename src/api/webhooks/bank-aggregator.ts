import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const bankAggregatorWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Bank aggregator webhook handler — Phase 0 stub' },
    });
  });
};

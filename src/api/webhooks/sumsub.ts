import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const sumsubWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Sumsub webhook handler — Phase 0 stub' },
    });
  });
};

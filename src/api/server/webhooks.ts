import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const serverWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/endpoints', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Register webhook endpoint — Phase 0 stub' },
    });
  });

  app.get('/endpoints', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'List webhook endpoints — Phase 0 stub' },
    });
  });
};

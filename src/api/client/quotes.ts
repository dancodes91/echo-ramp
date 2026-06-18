import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientQuoteRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Request quote — Phase 0 stub' },
    });
  });

  app.post('/:quoteId/accept', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Accept quote — Phase 0 stub' },
    });
  });
};

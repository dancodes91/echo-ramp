import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientBankRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/links', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Create bank link session — Phase 0 stub' },
    });
  });

  app.get('/links', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'List bank links — Phase 0 stub' },
    });
  });
};

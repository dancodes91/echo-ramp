import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const serverSessionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Create session — Phase 0 stub' },
    });
  });

  app.get('/:sessionId', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Get session — Phase 0 stub' },
    });
  });
};

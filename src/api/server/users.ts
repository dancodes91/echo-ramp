import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const serverUserRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Create or upsert end user — Phase 0 stub' },
    });
  });

  app.get('/:userId', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Get end user — Phase 0 stub' },
    });
  });
};

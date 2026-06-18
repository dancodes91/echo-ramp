import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientSessionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Get current session state — Phase 0 stub' },
    });
  });
};

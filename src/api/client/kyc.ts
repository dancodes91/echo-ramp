import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const clientKycRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/initiate', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Initiate KYC — Phase 0 stub' },
    });
  });

  app.get('/status', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Get KYC status — Phase 0 stub' },
    });
  });
};

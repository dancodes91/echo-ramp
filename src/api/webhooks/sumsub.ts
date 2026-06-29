import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { complianceService, ComplianceError } from '../../services/compliance.service.js';

export const sumsubWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (request, reply) => {
    try {
      await complianceService.handleKycWebhook(request.body);
      return reply.status(200).send({ received: true });
    } catch (err) {
      if (err instanceof ComplianceError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
};

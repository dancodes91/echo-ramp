import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { complianceService } from '../../services/compliance.service.js';

export const clientKycRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/initiate', async (_request, reply) => {
    return reply.status(501).send({
      error: { code: 'not_implemented', message: 'Initiate KYC — awaiting Sumsub sandbox credentials' },
    });
  });

  app.get('/status', async (request, reply) => {
    const sessionAuth = request.session;
    if (!sessionAuth) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }

    const kyc = await complianceService.getKycStatus(sessionAuth.userId);

    return reply.status(200).send({
      status: kyc?.status ?? 'pending',
      level: kyc?.level ?? 'basic',
      sumsub_applicant_id: kyc?.sumsubApplicantId ?? null,
    });
  });
};

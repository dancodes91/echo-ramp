import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { OrderError, orderService } from '../../services/order.service.js';

export const clientOrderRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/', async (request, reply) => {
    const sessionAuth = request.session;
    if (!sessionAuth) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }

    const body = request.body as { quote_id?: string };

    if (!body.quote_id) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'quote_id is required' },
      });
    }

    try {
      const order = await orderService.submitOrder({
        sessionId: sessionAuth.sessionId,
        quoteId: body.quote_id,
        integratorId: sessionAuth.integratorId,
      });

      return reply.status(201).send({
        order_id: order.id,
        provider_order_id: order.providerOrderId,
        status: order.status,
        compliance_status: order.complianceStatus,
        programme_deposit_address: order.programmeDepositAddress,
      });
    } catch (err) {
      if (err instanceof OrderError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.get('/:orderId', async (request, reply) => {
    const sessionAuth = request.session;
    if (!sessionAuth) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }

    const { orderId } = request.params as { orderId: string };
    const order = await orderService.getOrder(orderId);

    if (!order || order.sessionId !== sessionAuth.sessionId) {
      return reply.status(404).send({ error: { code: 'not_found', message: 'Order not found' } });
    }

    return reply.status(200).send({
      order_id: order.id,
      provider_order_id: order.providerOrderId,
      status: order.status,
      compliance_status: order.complianceStatus,
      programme_deposit_address: order.programmeDepositAddress,
    });
  });

  app.post('/:orderId/bank-payout', async (request, reply) => {
    const sessionAuth = request.session;
    if (!sessionAuth) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }

    const { orderId } = request.params as { orderId: string };
    const body = request.body as { bank_link_id?: string };

    try {
      const session = await orderService.initiateBankPayout(orderId, body.bank_link_id ?? '');
      return reply.status(200).send(session);
    } catch (err) {
      if (err instanceof OrderError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
};

import type { FastifyInstance } from 'fastify';
import { alertsQuerySchema } from '@allstarfamhub/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../lib/auth.js';

export default async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  /**
   * GET /alerts - List alerts for the family
   */
  app.get('/alerts', async (request, reply) => {
    const parsed = alertsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const { unread, limit, offset } = parsed.data;
    const familyId = request.auth.familyId;

    const where: {
      familyId: string;
      readAt?: null | { not: null };
    } = {
      familyId,
      ...(unread === true && { readAt: null }),
      ...(unread === false && { readAt: { not: null } }),
    };

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              eventType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.alert.count({ where }),
    ]);

    return reply.send({
      data: alerts,
      meta: { total, limit, offset },
    });
  });

  /**
   * PATCH /alerts/:id/read - Mark a single alert as read
   */
  app.patch<{ Params: { id: string } }>(
    '/alerts/:id/read',
    async (request, reply) => {
      const alert = await prisma.alert.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!alert) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Alert not found',
          statusCode: 404,
        });
      }

      const updated = await prisma.alert.update({
        where: { id: alert.id },
        data: { readAt: new Date() },
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * PATCH /alerts/read-all - Mark all unread alerts as read
   */
  app.patch('/alerts/read-all', async (request, reply) => {
    const result = await prisma.alert.updateMany({
      where: {
        familyId: request.auth.familyId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return reply.send({
      data: { marked: result.count },
    });
  });

  /**
   * DELETE /alerts/:id - Dismiss an alert
   */
  app.delete<{ Params: { id: string } }>(
    '/alerts/:id',
    async (request, reply) => {
      const alert = await prisma.alert.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!alert) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Alert not found',
          statusCode: 404,
        });
      }

      await prisma.alert.update({
        where: { id: alert.id },
        data: { dismissedAt: new Date() },
      });

      return reply.status(204).send();
    },
  );
}

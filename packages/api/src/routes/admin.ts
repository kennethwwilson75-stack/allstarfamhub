import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../lib/auth.js';

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  /**
   * GET /admin/stats - Platform statistics
   */
  app.get('/admin/stats', async (_request, reply) => {
    const [familyCount, userCount, memberCount, eventCount, integrationCount, alertCount] =
      await Promise.all([
        prisma.family.count(),
        prisma.user.count(),
        prisma.familyMember.count(),
        prisma.familyEvent.count(),
        prisma.integration.count(),
        prisma.alert.count(),
      ]);

    return reply.send({
      data: {
        families: familyCount,
        users: userCount,
        members: memberCount,
        events: eventCount,
        integrations: integrationCount,
        alerts: alertCount,
      },
    });
  });

  /**
   * GET /admin/integrations/errors - Failing integrations
   */
  app.get('/admin/integrations/errors', async (_request, reply) => {
    const failing = await prisma.integration.findMany({
      where: { status: 'ERROR' },
      select: {
        id: true,
        familyId: true,
        connectorId: true,
        displayName: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({ data: failing });
  });
}

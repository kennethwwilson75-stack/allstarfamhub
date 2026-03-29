import type { FastifyInstance } from 'fastify';
import {
  addMemberSchema,
  updateMemberSchema,
} from '@allstarfamhub/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireParentOrAdmin, requireAdmin } from '../lib/auth.js';

export default async function memberRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  /**
   * GET /members - List members for the current user's family
   * (Convenience route — web app uses this instead of /families/:id/members)
   */
  app.get('/members', async (request, reply) => {
    const members = await prisma.familyMember.findMany({
      where: { familyId: request.auth.familyId },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ data: members });
  });

  /**
   * POST /members - Add a member to the current user's family
   */
  app.post(
    '/members',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const parsed = addMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const member = await prisma.familyMember.create({
        data: {
          familyId: request.auth.familyId,
          ...parsed.data,
        },
      });

      return reply.status(201).send({ data: member });
    },
  );

  /**
   * PATCH /members/:id - Update a member
   */
  app.patch<{ Params: { id: string } }>(
    '/members/:id',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const parsed = updateMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const member = await prisma.familyMember.update({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
        data: parsed.data,
      });

      return reply.send({ data: member });
    },
  );

  /**
   * DELETE /members/:id - Remove a member
   */
  app.delete<{ Params: { id: string } }>(
    '/members/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      await prisma.familyMember.delete({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });
      return reply.status(204).send();
    },
  );

  /**
   * GET /members/:id/events - Events for a specific member
   */
  app.get<{ Params: { id: string } }>(
    '/members/:id/events',
    async (request, reply) => {
      const { id } = request.params;
      const familyId = request.auth.familyId;

      // Verify member belongs to the family
      const member = await prisma.familyMember.findFirst({
        where: { id, familyId },
      });

      if (!member) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Member not found',
          statusCode: 404,
        });
      }

      const events = await prisma.familyEvent.findMany({
        where: {
          familyId,
          members: { some: { memberId: id } },
          status: 'ACTIVE',
        },
        include: {
          members: { include: { member: true } },
        },
        orderBy: { startAt: 'asc' },
      });

      return reply.send({ data: events });
    },
  );

  /**
   * GET /members/:id/feed - Chronological feed (events + alerts) for a member
   */
  app.get<{ Params: { id: string } }>(
    '/members/:id/feed',
    async (request, reply) => {
      const { id } = request.params;
      const familyId = request.auth.familyId;

      // Verify member belongs to the family
      const member = await prisma.familyMember.findFirst({
        where: { id, familyId },
      });

      if (!member) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Member not found',
          statusCode: 404,
        });
      }

      const [events, alerts] = await Promise.all([
        prisma.familyEvent.findMany({
          where: {
            familyId,
            members: { some: { memberId: id } },
            status: 'ACTIVE',
          },
          include: {
            members: { include: { member: true } },
          },
          orderBy: { startAt: 'asc' },
          take: 50,
        }),
        prisma.alert.findMany({
          where: { familyId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

      // Merge into a chronological feed
      const feed = [
        ...events.map((e) => ({
          type: 'event' as const,
          id: e.id,
          timestamp: e.startAt.toISOString(),
          data: e,
        })),
        ...alerts.map((a) => ({
          type: 'alert' as const,
          id: a.id,
          timestamp: a.createdAt.toISOString(),
          data: a,
        })),
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return reply.send({ data: feed });
    },
  );
}

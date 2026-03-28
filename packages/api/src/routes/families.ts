import type { FastifyInstance } from 'fastify';
import {
  createFamilySchema,
  updateFamilySchema,
  addMemberSchema,
  updateMemberSchema,
  inviteMemberSchema,
} from '@allstarfamhub/shared';
import { prisma, type TransactionClient } from '../lib/prisma.js';
import { authenticate, requireParentOrAdmin, requireAdmin } from '../lib/auth.js';
import crypto from 'node:crypto';

export default async function familyRoutes(app: FastifyInstance): Promise<void> {
  // All family routes require authentication
  app.addHook('preHandler', authenticate);

  /**
   * GET /families/me - Get current user's family
   */
  app.get('/families/me', async (request, reply) => {
    const family = await prisma.family.findUnique({
      where: { id: request.auth.familyId },
      include: {
        members: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!family) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Family not found',
        statusCode: 404,
      });
    }

    return reply.send({ data: family });
  });

  /**
   * POST /families - Create a new family (user becomes admin)
   */
  app.post('/families', async (request, reply) => {
    const parsed = createFamilySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.auth.userId },
    });

    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
        statusCode: 404,
      });
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const family = await tx.family.create({
        data: {
          name: parsed.data.name,
          timezone: parsed.data.timezone,
        },
      });

      const member = await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          role: 'ADMIN',
          displayName: user.displayName ?? user.email,
        },
      });

      return { family, member };
    });

    return reply.status(201).send({ data: result.family });
  });

  /**
   * PATCH /families/:id - Update family settings
   */
  app.patch<{ Params: { id: string } }>(
    '/families/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      // Ensure user belongs to this family
      if (id !== request.auth.familyId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot modify another family',
          statusCode: 403,
        });
      }

      const parsed = updateFamilySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const family = await prisma.family.update({
        where: { id },
        data: parsed.data,
      });

      return reply.send({ data: family });
    },
  );

  /**
   * GET /families/:id/members - List family members
   */
  app.get<{ Params: { id: string } }>(
    '/families/:id/members',
    async (request, reply) => {
      const { id } = request.params;
      if (id !== request.auth.familyId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot access another family',
          statusCode: 403,
        });
      }

      const members = await prisma.familyMember.findMany({
        where: { familyId: id },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({ data: members });
    },
  );

  /**
   * POST /families/:id/members - Add a child/member profile (no user account)
   */
  app.post<{ Params: { id: string } }>(
    '/families/:id/members',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      if (id !== request.auth.familyId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot modify another family',
          statusCode: 403,
        });
      }

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
          familyId: id,
          ...parsed.data,
        },
      });

      return reply.status(201).send({ data: member });
    },
  );

  /**
   * PATCH /families/:id/members/:memberId - Update a member
   */
  app.patch<{ Params: { id: string; memberId: string } }>(
    '/families/:id/members/:memberId',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const { id, memberId } = request.params;
      if (id !== request.auth.familyId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot modify another family',
          statusCode: 403,
        });
      }

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
        where: { id: memberId, familyId: id },
        data: parsed.data,
      });

      return reply.send({ data: member });
    },
  );

  /**
   * DELETE /families/:id/members/:memberId - Remove a member
   */
  app.delete<{ Params: { id: string; memberId: string } }>(
    '/families/:id/members/:memberId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id, memberId } = request.params;
      if (id !== request.auth.familyId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot modify another family',
          statusCode: 403,
        });
      }

      await prisma.familyMember.delete({
        where: { id: memberId, familyId: id },
      });

      return reply.status(204).send();
    },
  );

  /**
   * POST /families/:id/invite - Send an invite to join the family
   */
  app.post<{ Params: { id: string } }>(
    '/families/:id/invite',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      if (id !== request.auth.familyId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot invite to another family',
          statusCode: 403,
        });
      }

      const parsed = inviteMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await prisma.familyInvite.create({
        data: {
          familyId: id,
          email: parsed.data.email,
          role: parsed.data.role,
          token,
          expiresAt,
        },
      });

      // TODO: Send email via SendGrid with invite link
      const inviteUrl = `${process.env['WEB_URL'] ?? 'http://localhost:3000'}/join/${token}`;

      return reply.status(201).send({
        data: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          inviteUrl,
        },
      });
    },
  );

  /**
   * POST /families/join/:token - Accept an invite
   */
  app.post<{ Params: { token: string } }>(
    '/families/join/:token',
    async (request, reply) => {
      // This route needs authentication but not family membership check
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required to join a family',
          statusCode: 401,
        });
      }

      // Use the authenticate hook manually
      await authenticate(request, reply);
      if (reply.sent) return;

      const { token } = request.params;

      const invite = await prisma.familyInvite.findUnique({
        where: { token },
      });

      if (!invite) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invalid invite token',
          statusCode: 404,
        });
      }

      if (invite.usedAt) {
        return reply.status(410).send({
          error: 'Gone',
          message: 'Invite has already been used',
          statusCode: 410,
        });
      }

      if (invite.expiresAt < new Date()) {
        return reply.status(410).send({
          error: 'Gone',
          message: 'Invite has expired',
          statusCode: 410,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: request.auth.userId },
      });

      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404,
        });
      }

      const result = await prisma.$transaction(async (tx: TransactionClient) => {
        const member = await tx.familyMember.create({
          data: {
            familyId: invite.familyId,
            userId: user.id,
            role: invite.role,
            displayName: user.displayName ?? user.email,
          },
        });

        await tx.familyInvite.update({
          where: { id: invite.id },
          data: { usedAt: new Date() },
        });

        return member;
      });

      return reply.status(201).send({ data: result });
    },
  );
}

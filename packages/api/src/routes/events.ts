import type { FastifyInstance } from 'fastify';
import {
  createEventSchema,
  updateEventSchema,
  eventsQuerySchema,
} from '@allstarfamhub/shared';
import { prisma, type TransactionClient } from '../lib/prisma.js';
import { authenticate } from '../lib/auth.js';
import { detectConflicts } from '../services/conflict-detector.js';

export default async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  /**
   * GET /events - List events with filters
   */
  app.get('/events', async (request, reply) => {
    const parsed = eventsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const { memberId, start, end, type, limit, offset } = parsed.data;
    const familyId = request.auth.familyId;

    // Build the where clause inline to avoid Prisma namespace import issues
    const startAtFilter =
      start && end
        ? { gte: new Date(start), lte: new Date(end) }
        : start
          ? { gte: new Date(start) }
          : end
            ? { lte: new Date(end) }
            : undefined;

    const where = {
      familyId,
      ...(type && { eventType: type }),
      ...(startAtFilter && { startAt: startAtFilter }),
      ...(memberId && {
        members: { some: { memberId } },
      }),
    };

    const [events, total] = await Promise.all([
      prisma.familyEvent.findMany({
        where,
        include: {
          members: {
            include: { member: true },
          },
        },
        orderBy: { startAt: 'asc' as const },
        take: limit,
        skip: offset,
      }),
      prisma.familyEvent.count({ where }),
    ]);

    return reply.send({
      data: events,
      meta: { total, limit, offset },
    });
  });

  /**
   * GET /events/today - Shortcut for today's events
   */
  app.get('/events/today', async (request, reply) => {
    const familyId = request.auth.familyId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999,
    );

    const events = await prisma.familyEvent.findMany({
      where: {
        familyId,
        startAt: { gte: startOfDay, lte: endOfDay },
        status: 'ACTIVE',
      },
      include: {
        members: {
          include: { member: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    return reply.send({ data: events });
  });

  /**
   * GET /events/conflicts - Find scheduling conflicts
   */
  app.get('/events/conflicts', async (request, reply) => {
    const familyId = request.auth.familyId;
    const conflicts = await detectConflicts(familyId);
    return reply.send({ data: conflicts });
  });

  /**
   * POST /events - Create a manual event
   */
  app.post('/events', async (request, reply) => {
    const parsed = createEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const { memberIds, ...eventData } = parsed.data;
    const familyId = request.auth.familyId;

    const event = await prisma.familyEvent.create({
      data: {
        familyId,
        title: eventData.title,
        startAt: new Date(eventData.startAt),
        endAt: eventData.endAt ? new Date(eventData.endAt) : null,
        allDay: eventData.allDay,
        eventType: eventData.eventType,
        location: eventData.location,
        description: eventData.description,
        priority: eventData.priority,
        deadlineAt: eventData.deadlineAt ? new Date(eventData.deadlineAt) : null,
        ...(memberIds && memberIds.length > 0
          ? {
              members: {
                create: memberIds.map((memberId) => ({ memberId })),
              },
            }
          : {}),
      },
      include: {
        members: {
          include: { member: true },
        },
      },
    });

    return reply.status(201).send({ data: event });
  });

  /**
   * GET /events/:id - Get single event
   */
  app.get<{ Params: { id: string } }>(
    '/events/:id',
    async (request, reply) => {
      const event = await prisma.familyEvent.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
        include: {
          members: {
            include: { member: true },
          },
          changeLog: {
            orderBy: { changedAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!event) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Event not found',
          statusCode: 404,
        });
      }

      return reply.send({ data: event });
    },
  );

  /**
   * PATCH /events/:id - Update an event
   */
  app.patch<{ Params: { id: string } }>(
    '/events/:id',
    async (request, reply) => {
      const parsed = updateEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const existing = await prisma.familyEvent.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Event not found',
          statusCode: 404,
        });
      }

      const { memberIds, ...updateData } = parsed.data;

      // Build change log entries
      const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          const oldVal = existing[key as keyof typeof existing];
          const oldStr = oldVal != null ? String(oldVal) : null;
          const newStr = value != null ? String(value) : null;
          if (oldStr !== newStr) {
            changes.push({ field: key, oldValue: oldStr, newValue: newStr });
          }
        }
      }

      const event = await prisma.$transaction(async (tx: TransactionClient) => {
        // Log changes
        if (changes.length > 0) {
          await tx.eventChangeLog.createMany({
            data: changes.map((c) => ({
              eventId: existing.id,
              ...c,
            })),
          });
        }

        // Update member associations if provided
        if (memberIds) {
          await tx.eventMember.deleteMany({
            where: { eventId: existing.id },
          });
          if (memberIds.length > 0) {
            await tx.eventMember.createMany({
              data: memberIds.map((memberId) => ({
                eventId: existing.id,
                memberId,
              })),
            });
          }
        }

        return tx.familyEvent.update({
          where: { id: existing.id },
          data: {
            ...(updateData.title !== undefined && { title: updateData.title }),
            ...(updateData.startAt !== undefined && {
              startAt: new Date(updateData.startAt),
            }),
            ...(updateData.endAt !== undefined && {
              endAt: new Date(updateData.endAt),
            }),
            ...(updateData.allDay !== undefined && { allDay: updateData.allDay }),
            ...(updateData.eventType !== undefined && {
              eventType: updateData.eventType,
            }),
            ...(updateData.location !== undefined && {
              location: updateData.location,
            }),
            ...(updateData.description !== undefined && {
              description: updateData.description,
            }),
            ...(updateData.priority !== undefined && {
              priority: updateData.priority,
            }),
            ...(updateData.status !== undefined && { status: updateData.status }),
          },
          include: {
            members: {
              include: { member: true },
            },
          },
        });
      });

      return reply.send({ data: event });
    },
  );

  /**
   * DELETE /events/:id - Soft-delete (cancel) an event
   */
  app.delete<{ Params: { id: string } }>(
    '/events/:id',
    async (request, reply) => {
      const existing = await prisma.familyEvent.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Event not found',
          statusCode: 404,
        });
      }

      await prisma.familyEvent.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });

      return reply.status(204).send();
    },
  );
}

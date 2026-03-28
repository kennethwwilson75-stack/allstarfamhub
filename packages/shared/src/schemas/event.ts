import { z } from 'zod';

const isoDatetime = z.string().datetime();

export const createEventSchema = z
  .object({
    title: z.string().min(1).max(500),
    startAt: isoDatetime,
    endAt: isoDatetime.optional(),
    allDay: z.boolean().default(false),
    eventType: z
      .enum([
        'ASSIGNMENT',
        'EXAM',
        'SCHOOL_EVENT',
        'NO_SCHOOL',
        'SPORTS',
        'MEETING',
        'ANNOUNCEMENT',
        'PERSONAL',
      ])
      .default('PERSONAL'),
    location: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    memberIds: z.array(z.string()).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    deadlineAt: isoDatetime.optional(),
  })
  .refine((data) => !data.endAt || new Date(data.endAt) > new Date(data.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  startAt: isoDatetime.optional(),
  endAt: isoDatetime.optional(),
  allDay: z.boolean().optional(),
  eventType: z
    .enum([
      'ASSIGNMENT',
      'EXAM',
      'SCHOOL_EVENT',
      'NO_SCHOOL',
      'SPORTS',
      'MEETING',
      'ANNOUNCEMENT',
      'PERSONAL',
    ])
    .optional(),
  location: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  memberIds: z.array(z.string()).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['ACTIVE', 'CANCELLED', 'COMPLETED']).optional(),
});

export const eventsQuerySchema = z.object({
  memberId: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  type: z
    .enum([
      'ASSIGNMENT',
      'EXAM',
      'SCHOOL_EVENT',
      'NO_SCHOOL',
      'SPORTS',
      'MEETING',
      'ANNOUNCEMENT',
      'PERSONAL',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const alertsQuerySchema = z.object({
  unread: z.coerce.boolean().optional(),
  memberId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

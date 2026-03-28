import type { AlertType } from '@allstarfamhub/shared';
import { prisma } from '../lib/prisma.js';

interface AlertInput {
  familyId: string;
  eventId?: string;
  type: AlertType;
  title: string;
  body: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;
}

/**
 * Generate an alert, deduplicating by family + event + type.
 * If an identical unread alert already exists, skip creation.
 */
export async function generateAlert(input: AlertInput): Promise<void> {
  const { familyId, eventId, type, title, body, priority, actionUrl } = input;

  // Dedup: skip if an identical unread alert exists for this event+type
  if (eventId) {
    const existing = await prisma.alert.findFirst({
      where: {
        familyId,
        eventId,
        type,
        readAt: null,
        dismissedAt: null,
      },
    });

    if (existing) {
      return; // Already alerted, skip
    }
  }

  await prisma.alert.create({
    data: {
      familyId,
      eventId,
      type,
      title,
      body,
      priority: priority ?? 'NORMAL',
      actionUrl,
    },
  });
}

/**
 * Generate alerts for new events.
 */
export async function alertNewEvent(
  familyId: string,
  eventId: string,
  eventTitle: string,
): Promise<void> {
  await generateAlert({
    familyId,
    eventId,
    type: 'EVENT_ADDED',
    title: 'New event added',
    body: eventTitle,
    actionUrl: `/events/${eventId}`,
  });
}

/**
 * Generate alerts for changed events based on which fields changed.
 */
export async function alertEventChanged(
  familyId: string,
  eventId: string,
  eventTitle: string,
  changedFields: string[],
): Promise<void> {
  // Generate specific alert types for important changes
  if (changedFields.includes('startAt') || changedFields.includes('endAt')) {
    await generateAlert({
      familyId,
      eventId,
      type: 'TIME_CHANGED',
      title: 'Event time changed',
      body: `"${eventTitle}" has been rescheduled`,
      priority: 'HIGH',
      actionUrl: `/events/${eventId}`,
    });
  }

  if (changedFields.includes('location')) {
    await generateAlert({
      familyId,
      eventId,
      type: 'LOCATION_CHANGED',
      title: 'Event location changed',
      body: `"${eventTitle}" has a new location`,
      actionUrl: `/events/${eventId}`,
    });
  }

  // General change alert for other fields
  const nonSpecificChanges = changedFields.filter(
    (f) => !['startAt', 'endAt', 'location'].includes(f),
  );
  if (nonSpecificChanges.length > 0) {
    await generateAlert({
      familyId,
      eventId,
      type: 'EVENT_CHANGED',
      title: 'Event updated',
      body: `"${eventTitle}" has been updated (${nonSpecificChanges.join(', ')})`,
      actionUrl: `/events/${eventId}`,
    });
  }
}

/**
 * Generate deadline alerts for events with approaching deadlines.
 * Call this periodically (e.g., from a cron/BullMQ job).
 */
export async function generateDeadlineAlerts(
  familyId: string,
): Promise<number> {
  const now = new Date();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23, 59, 59, 999,
  );

  let alertCount = 0;

  // Deadline today
  const todayDeadlines = await prisma.familyEvent.findMany({
    where: {
      familyId,
      deadlineAt: {
        gte: now,
        lte: endOfToday,
      },
      status: 'ACTIVE',
    },
  });

  for (const event of todayDeadlines) {
    await generateAlert({
      familyId,
      eventId: event.id,
      type: 'DEADLINE_TODAY',
      title: 'Deadline today',
      body: `"${event.title}" is due today`,
      priority: 'URGENT',
      actionUrl: `/events/${event.id}`,
    });
    alertCount++;
  }

  // Deadline tomorrow
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const endOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23, 59, 59, 999,
  );

  const tomorrowDeadlines = await prisma.familyEvent.findMany({
    where: {
      familyId,
      deadlineAt: {
        gte: startOfTomorrow,
        lte: endOfTomorrow,
      },
      status: 'ACTIVE',
    },
  });

  for (const event of tomorrowDeadlines) {
    await generateAlert({
      familyId,
      eventId: event.id,
      type: 'DEADLINE_TOMORROW',
      title: 'Deadline tomorrow',
      body: `"${event.title}" is due tomorrow`,
      priority: 'HIGH',
      actionUrl: `/events/${event.id}`,
    });
    alertCount++;
  }

  return alertCount;
}

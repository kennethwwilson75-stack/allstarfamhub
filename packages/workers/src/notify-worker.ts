import { Worker, type Job } from 'bullmq';
import { getRedis } from './lib/redis.js';
import { getPrisma } from './lib/prisma.js';
import { NOTIFY_QUEUE, type NotifyJobData } from './queues.js';

/**
 * Check if current time is within quiet hours for the given timezone.
 */
function isInQuietHours(
  quietHoursStart: string,
  quietHoursEnd: string,
  timezone: string,
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = (currentHour ?? 0) * 60 + (currentMinute ?? 0);

    const [startH, startM] = quietHoursStart.split(':').map(Number);
    const [endH, endM] = quietHoursEnd.split(':').map(Number);
    const startMinutes = (startH ?? 21) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 7) * 60 + (endM ?? 0);

    // Handle overnight quiet hours (e.g., 21:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    // If timezone parsing fails, assume not in quiet hours
    return false;
  }
}

/**
 * Stub FCM push notification sender.
 * Replace with actual Firebase Admin SDK call in production.
 */
async function sendPushNotification(
  token: string,
  title: string,
  _body: string,
  _data?: Record<string, string>,
): Promise<boolean> {
  // TODO: Replace with actual FCM call using firebase-admin
  console.log(`[notify-worker] STUB: Push to token=${token.slice(0, 8)}... title="${title}"`);

  // In production:
  // const admin = require('firebase-admin');
  // await admin.messaging().send({
  //   token,
  //   notification: { title, body },
  //   data,
  // });

  return true;
}

async function processNotifyJob(job: Job<NotifyJobData>): Promise<void> {
  const prisma = getPrisma();
  const { familyId, title, body, targetUserIds, priority, actionUrl } = job.data;

  console.log(`[notify-worker] Processing notification for family=${familyId}: "${title}"`);

  // Load family for timezone
  const family = await prisma.family.findUnique({
    where: { id: familyId },
  });

  if (!family) {
    console.error(`[notify-worker] Family ${familyId} not found`);
    return;
  }

  // Load notification preferences for the family
  const prefs = await prisma.notificationPreferences.findMany({
    where: { familyId },
  });

  // Determine target users
  let userIds = targetUserIds;
  if (userIds.length === 0) {
    // Send to all family members with linked users
    const members = await prisma.familyMember.findMany({
      where: { familyId, userId: { not: null } },
      select: { userId: true },
    });
    userIds = members
      .map((m: { userId: string | null }) => m.userId)
      .filter((id: string | null): id is string => id !== null);
  }

  if (userIds.length === 0) {
    console.log(`[notify-worker] No target users for family=${familyId}, skipping`);
    return;
  }

  // Check global/family-level notification preferences
  const familyPrefs = prefs.find((p: { memberId: string | null }) => p.memberId === null);

  if (familyPrefs && !familyPrefs.pushEnabled) {
    console.log(`[notify-worker] Push disabled for family=${familyId}, skipping`);
    return;
  }

  // Quiet hours check
  if (
    familyPrefs?.quietHoursEnabled &&
    priority !== 'URGENT' &&
    isInQuietHours(familyPrefs.quietHoursStart, familyPrefs.quietHoursEnd, family.timezone)
  ) {
    console.log(`[notify-worker] Quiet hours active for family=${familyId}, skipping non-urgent notification`);
    return;
  }

  // Load push tokens for target users
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });

  if (pushTokens.length === 0) {
    console.log(`[notify-worker] No push tokens found for target users, skipping`);
    return;
  }

  // Send to each token
  const results = await Promise.allSettled(
    pushTokens.map((pt: { token: string }) =>
      sendPushNotification(pt.token, title, body, {
        familyId,
        priority,
        ...(actionUrl ? { actionUrl } : {}),
      }),
    ),
  );

  const sent = results.filter((r: PromiseSettledResult<boolean>) => r.status === 'fulfilled').length;
  const failed = results.filter((r: PromiseSettledResult<boolean>) => r.status === 'rejected').length;

  console.log(`[notify-worker] Sent ${sent}/${pushTokens.length} notifications (${failed} failed)`);

  // Create alert record
  await prisma.alert.create({
    data: {
      familyId,
      type: 'EVENT_CHANGED', // Default type; caller should set more specific type
      title,
      body,
      priority: priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
      actionUrl,
    },
  });
}

/**
 * Create and return the notification worker.
 */
export function createNotifyWorker(): Worker<NotifyJobData> {
  const worker = new Worker<NotifyJobData>(NOTIFY_QUEUE, processNotifyJob, {
    connection: getRedis(),
    concurrency: 10,
  });

  worker.on('completed', (job) => {
    console.log(`[notify-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[notify-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

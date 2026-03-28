import { Worker, type Job } from 'bullmq';
import { getRedis } from './lib/redis.js';
import { getPrisma } from './lib/prisma.js';
import {
  SCHEDULER_QUEUE,
  type SchedulerJobData,
  getSyncQueue,
  getNotifyQueue,
  getSchedulerQueue,
  type SyncJobData,
} from './queues.js';

/**
 * Check for integrations that need syncing and enqueue sync jobs.
 */
async function checkSyncDue(): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();

  const dueIntegrations = await prisma.integration.findMany({
    where: {
      status: { in: ['ACTIVE', 'PENDING'] },
      nextSyncAt: { lte: now },
    },
    select: {
      id: true,
      familyId: true,
      connectorId: true,
      method: true,
    },
    take: 100, // Process in batches to avoid overwhelming the queue
  });

  if (dueIntegrations.length === 0) {
    return;
  }

  const syncQueue = getSyncQueue();

  for (const integration of dueIntegrations) {
    const jobData: SyncJobData = {
      integrationId: integration.id,
      familyId: integration.familyId,
      connectorId: integration.connectorId,
      method: integration.method,
    };

    await syncQueue.add(`sync-${integration.id}`, jobData, {
      jobId: `sync-${integration.id}-${Date.now()}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30_000, // 30s base delay
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  console.log(`[scheduler] Enqueued ${dueIntegrations.length} sync jobs`);
}

/**
 * Sweep for upcoming deadlines and send alerts.
 */
async function deadlineAlertSweep(): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endOfTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Find events with deadlines today
  const todayDeadlines = await prisma.familyEvent.findMany({
    where: {
      deadlineAt: { gte: now, lt: tomorrow },
      status: 'ACTIVE',
    },
    include: {
      members: { include: { member: { select: { userId: true } } } },
    },
  });

  // Find events with deadlines tomorrow
  const tomorrowDeadlines = await prisma.familyEvent.findMany({
    where: {
      deadlineAt: { gte: tomorrow, lt: endOfTomorrow },
      status: 'ACTIVE',
    },
    include: {
      members: { include: { member: { select: { userId: true } } } },
    },
  });

  const notifyQueue = getNotifyQueue();

  for (const event of todayDeadlines) {
    const targetUserIds = event.members
      .map((em: { member: { userId: string | null } }) => em.member.userId)
      .filter((id: string | null): id is string => id !== null);

    await notifyQueue.add('deadline-today', {
      alertId: '',
      familyId: event.familyId,
      title: `Due today: ${event.title}`,
      body: event.description ?? `${event.title} is due today`,
      targetUserIds,
      priority: 'HIGH',
    });
  }

  for (const event of tomorrowDeadlines) {
    const targetUserIds = event.members
      .map((em: { member: { userId: string | null } }) => em.member.userId)
      .filter((id: string | null): id is string => id !== null);

    await notifyQueue.add('deadline-tomorrow', {
      alertId: '',
      familyId: event.familyId,
      title: `Due tomorrow: ${event.title}`,
      body: event.description ?? `${event.title} is due tomorrow`,
      targetUserIds,
      priority: 'NORMAL',
    });
  }

  console.log(
    `[scheduler] Deadline sweep: ${todayDeadlines.length} today, ${tomorrowDeadlines.length} tomorrow`,
  );
}

/**
 * Clean up old RawItems older than 90 days.
 */
async function cleanupOldRawItems(): Promise<void> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const result = await prisma.rawItem.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      processedAt: { not: null }, // Only delete processed items
    },
  });

  console.log(`[scheduler] Cleaned up ${result.count} old RawItems (>90 days)`);
}

async function processSchedulerJob(job: Job<SchedulerJobData>): Promise<void> {
  const { task } = job.data;

  switch (task) {
    case 'check-sync-due':
      await checkSyncDue();
      break;
    case 'deadline-alerts':
      await deadlineAlertSweep();
      break;
    case 'cleanup-raw-items':
      await cleanupOldRawItems();
      break;
    default:
      console.warn(`[scheduler] Unknown task: ${task}`);
  }
}

/**
 * Register recurring scheduler jobs using BullMQ repeat/cron.
 */
export async function registerSchedulerJobs(): Promise<void> {
  const schedulerQueue = getSchedulerQueue();

  // Every 1 minute: check for integrations needing sync
  await schedulerQueue.upsertJobScheduler(
    'check-sync-due',
    { every: 60_000 },
    {
      name: 'check-sync-due',
      data: { task: 'check-sync-due' as const },
    },
  );

  // Daily at 6:00 AM UTC: deadline alert sweep
  await schedulerQueue.upsertJobScheduler(
    'deadline-alerts',
    { pattern: '0 6 * * *' },
    {
      name: 'deadline-alerts',
      data: { task: 'deadline-alerts' as const },
    },
  );

  // Daily at 3:00 AM UTC: cleanup old RawItems
  await schedulerQueue.upsertJobScheduler(
    'cleanup-raw-items',
    { pattern: '0 3 * * *' },
    {
      name: 'cleanup-raw-items',
      data: { task: 'cleanup-raw-items' as const },
    },
  );

  console.log('[scheduler] Recurring jobs registered');
}

/**
 * Create and return the scheduler worker.
 */
export function createSchedulerWorker(): Worker<SchedulerJobData> {
  const worker = new Worker<SchedulerJobData>(SCHEDULER_QUEUE, processSchedulerJob, {
    connection: getRedis(),
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    console.log(`[scheduler] Job ${job.id} (${job.data.task}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[scheduler] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

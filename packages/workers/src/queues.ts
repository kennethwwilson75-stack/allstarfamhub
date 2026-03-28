import { Queue } from 'bullmq';
import { getRedis } from './lib/redis.js';

// ─── Queue Names ────────────────────────────────────────────────

export const SYNC_QUEUE = 'sync' as const;
export const PARSE_QUEUE = 'parse' as const;
export const NOTIFY_QUEUE = 'notify' as const;
export const SCHEDULER_QUEUE = 'scheduler' as const;

// ─── Job Data Types ─────────────────────────────────────────────

export interface SyncJobData {
  integrationId: string;
  familyId: string;
  connectorId: string;
  method: string;
  /** Force sync regardless of schedule */
  force?: boolean;
}

export interface ParseJobData {
  rawItemId: string;
  integrationId: string;
  familyId: string;
  emailSubject: string;
  emailBody: string;
  /** Optional member ID to associate parsed events with */
  memberId?: string;
}

export interface NotifyJobData {
  alertId: string;
  familyId: string;
  title: string;
  body: string;
  /** Target user IDs; if empty, send to all family members */
  targetUserIds: string[];
  priority: string;
  actionUrl?: string;
}

export interface SchedulerJobData {
  task: 'check-sync-due' | 'deadline-alerts' | 'cleanup-raw-items';
}

// ─── Queue Instances ────────────────────────────────────────────

let syncQueue: Queue<SyncJobData> | null = null;
let parseQueue: Queue<ParseJobData> | null = null;
let notifyQueue: Queue<NotifyJobData> | null = null;
let schedulerQueue: Queue<SchedulerJobData> | null = null;

export function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobData>(SYNC_QUEUE, { connection: getRedis() });
  }
  return syncQueue;
}

export function getParseQueue(): Queue<ParseJobData> {
  if (!parseQueue) {
    parseQueue = new Queue<ParseJobData>(PARSE_QUEUE, { connection: getRedis() });
  }
  return parseQueue;
}

export function getNotifyQueue(): Queue<NotifyJobData> {
  if (!notifyQueue) {
    notifyQueue = new Queue<NotifyJobData>(NOTIFY_QUEUE, { connection: getRedis() });
  }
  return notifyQueue;
}

export function getSchedulerQueue(): Queue<SchedulerJobData> {
  if (!schedulerQueue) {
    schedulerQueue = new Queue<SchedulerJobData>(SCHEDULER_QUEUE, {
      connection: getRedis(),
    });
  }
  return schedulerQueue;
}

/**
 * Close all queue instances gracefully.
 */
export async function closeAllQueues(): Promise<void> {
  const queues = [syncQueue, parseQueue, notifyQueue, schedulerQueue];
  await Promise.all(queues.map((q) => q?.close()));
  syncQueue = null;
  parseQueue = null;
  notifyQueue = null;
  schedulerQueue = null;
}

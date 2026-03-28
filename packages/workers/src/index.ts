import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import type { Worker } from 'bullmq';
import { createSyncWorker } from './sync-worker.js';
import { createParseWorker } from './parsers/email-parser.js';
import { createNotifyWorker } from './notify-worker.js';
import { createSchedulerWorker, registerSchedulerJobs } from './scheduler.js';
import { closeRedis } from './lib/redis.js';
import { closePrisma } from './lib/prisma.js';
import { closeAllQueues } from './queues.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Worker generic type varies per queue
const workers: Worker<any>[] = [];
let isShuttingDown = false;

async function main(): Promise<void> {
  console.log('[workers] Starting All Star Fam Hub workers...');

  // Validate required env vars
  const required = ['REDIS_URL', 'DATABASE_URL'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[workers] Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }

  // Start all workers
  const syncWorker = createSyncWorker();
  const parseWorker = createParseWorker();
  const notifyWorker = createNotifyWorker();
  const schedulerWorker = createSchedulerWorker();

  workers.push(syncWorker, parseWorker, notifyWorker, schedulerWorker);

  // Register recurring scheduler jobs
  await registerSchedulerJobs();

  console.log('[workers] All workers started successfully');
  console.log('[workers]   - Sync worker (concurrency: 5)');
  console.log('[workers]   - Email parser worker (concurrency: 3)');
  console.log('[workers]   - Notification worker (concurrency: 10)');
  console.log('[workers]   - Scheduler worker (concurrency: 1)');
}

async function shutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[workers] Shutting down gracefully...');

  // Close all workers (waits for active jobs to complete)
  await Promise.all(workers.map((w) => w.close()));
  console.log('[workers] All workers stopped');

  // Close queues
  await closeAllQueues();
  console.log('[workers] All queues closed');

  // Close connections
  await closePrisma();
  await closeRedis();
  console.log('[workers] Connections closed');

  process.exit(0);
}

// Graceful shutdown handlers
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

// Unhandled rejection handler
process.on('unhandledRejection', (reason) => {
  console.error('[workers] Unhandled rejection:', reason);
});

// Start
main().catch((err) => {
  console.error('[workers] Fatal startup error:', err);
  process.exit(1);
});

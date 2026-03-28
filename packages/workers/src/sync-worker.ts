import { Worker, type Job } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { getRedis } from './lib/redis.js';
import { getPrisma } from './lib/prisma.js';
import { SYNC_QUEUE, type SyncJobData, getNotifyQueue } from './queues.js';
import { classifyEventType, computePriority } from '@allstarfamhub/shared';
import type { ConnectorConfig, ConnectorCredentials, RawEventData } from '@allstarfamhub/shared';

/**
 * Connector registry — dynamically loads connector by ID.
 * Falls back to a no-op connector if not found.
 */
async function loadConnector(connectorId: string) {
  // Dynamic import from connectors package
  // As connectors are added, they register themselves in the connectors index
  try {
    const mod = await import('@allstarfamhub/connectors');
    const getConnector = mod.getConnector as
      | ((id: string) => import('@allstarfamhub/shared').Connector | undefined)
      | undefined;
    if (getConnector) {
      return getConnector(connectorId);
    }
    return undefined;
  } catch {
    console.warn(`[sync-worker] Connector package not available for ${connectorId}`);
    return undefined;
  }
}

/**
 * Normalize a RawEventData into a FamilyEvent upsert.
 */
function normalizeEvent(
  raw: RawEventData,
  familyId: string,
  integrationId: string,
  rawItemId: string,
) {
  const eventType = raw.eventType
    ? (raw.eventType as ReturnType<typeof classifyEventType>)
    : classifyEventType(raw.title);
  const priority = computePriority(raw.startAt);

  return {
    familyId,
    sourceIntegrationId: integrationId,
    sourceItemId: rawItemId,
    externalId: raw.externalId,
    title: raw.title,
    description: raw.description ?? null,
    eventType,
    startAt: raw.startAt,
    endAt: raw.endAt ?? null,
    allDay: raw.allDay ?? false,
    location: raw.location ?? null,
    priority,
    status: 'ACTIVE' as const,
  };
}

async function processSyncJob(job: Job<SyncJobData>): Promise<void> {
  const prisma = getPrisma();
  const { integrationId, familyId, connectorId } = job.data;

  console.log(`[sync-worker] Processing sync for integration=${integrationId} connector=${connectorId}`);

  // Load integration from DB
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    include: { family: true },
  });

  if (!integration) {
    console.error(`[sync-worker] Integration ${integrationId} not found`);
    return;
  }

  if (integration.status === 'PAUSED' || integration.status === 'EXPIRED') {
    console.log(`[sync-worker] Integration ${integrationId} is ${integration.status}, skipping`);
    return;
  }

  // Load connector
  const connector = await loadConnector(connectorId);
  if (!connector) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncStatus: 'ERROR',
        lastSyncError: `Connector "${connectorId}" not found or not implemented`,
        lastSyncAt: new Date(),
      },
    });
    return;
  }

  // Build connector config
  const credentials: ConnectorCredentials = {};
  if (integration.accessToken) credentials.accessToken = integration.accessToken;
  if (integration.refreshToken) credentials.refreshToken = integration.refreshToken;
  if (integration.feedUrl) credentials.feedUrl = integration.feedUrl;

  const config: ConnectorConfig = {
    integrationId: integration.id,
    familyId: integration.familyId,
    memberId: integration.memberId ?? undefined,
    credentials,
    scraperConfig: (integration.scraperConfig as Record<string, unknown>) ?? undefined,
    lastSyncAt: integration.lastSyncAt ?? undefined,
  };

  try {
    // Execute sync
    const result = await connector.sync(config);

    // Process events and announcements
    const allItems = [...result.events, ...result.announcements];
    let upsertedCount = 0;

    for (const raw of allItems) {
      // Upsert RawItem
      const rawItem = await prisma.rawItem.upsert({
        where: {
          integrationId_sourceId: {
            integrationId: integration.id,
            sourceId: raw.externalId,
          },
        },
        update: {
          rawPayload: raw.rawPayload as Prisma.InputJsonValue,
          parsedAt: new Date(),
          processedAt: null,
        },
        create: {
          integrationId: integration.id,
          sourceId: raw.externalId,
          rawPayload: raw.rawPayload as Prisma.InputJsonValue,
          parsedAt: new Date(),
        },
      });

      // Normalize and upsert FamilyEvent
      const normalized = normalizeEvent(raw, familyId, integration.id, rawItem.id);

      const existingEvent = await prisma.familyEvent.findFirst({
        where: {
          externalId: raw.externalId,
          sourceIntegrationId: integration.id,
        },
      });

      if (existingEvent) {
        // Check for changes and create change log entries
        const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> =
          [];

        if (existingEvent.title !== normalized.title) {
          changes.push({
            field: 'title',
            oldValue: existingEvent.title,
            newValue: normalized.title,
          });
        }
        if (existingEvent.startAt.getTime() !== normalized.startAt.getTime()) {
          changes.push({
            field: 'startAt',
            oldValue: existingEvent.startAt.toISOString(),
            newValue: normalized.startAt.toISOString(),
          });
        }
        if (existingEvent.location !== normalized.location) {
          changes.push({
            field: 'location',
            oldValue: existingEvent.location,
            newValue: normalized.location,
          });
        }

        await prisma.familyEvent.update({
          where: { id: existingEvent.id },
          data: {
            ...normalized,
            updatedAt: new Date(),
          },
        });

        // Log changes
        if (changes.length > 0) {
          await prisma.eventChangeLog.createMany({
            data: changes.map((c) => ({
              eventId: existingEvent.id,
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
            })),
          });

          // Enqueue notification for changes
          const notifyQueue = getNotifyQueue();
          await notifyQueue.add('event-changed', {
            alertId: '', // will be created by notify worker
            familyId,
            title: `Event updated: ${normalized.title}`,
            body: `${changes.map((c) => c.field).join(', ')} changed`,
            targetUserIds: [],
            priority: normalized.priority,
          });
        }
      } else {
        // Create new event
        const newEvent = await prisma.familyEvent.create({
          data: normalized,
        });

        // Link to member if integration has one
        if (integration.memberId) {
          await prisma.eventMember.create({
            data: {
              eventId: newEvent.id,
              memberId: integration.memberId,
            },
          });
        }
      }

      // Mark RawItem as processed
      await prisma.rawItem.update({
        where: { id: rawItem.id },
        data: { processedAt: new Date() },
      });

      upsertedCount++;
    }

    // Update integration sync state
    const nextSyncAt = result.nextSyncRecommendedAt ??
      new Date(Date.now() + integration.syncIntervalMin * 60 * 1000);

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: `OK — ${upsertedCount} items`,
        lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        nextSyncAt,
        status: 'ACTIVE',
      },
    });

    console.log(`[sync-worker] Sync complete for integration=${integrationId}: ${upsertedCount} items`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sync-worker] Sync failed for integration=${integrationId}:`, message);

    // Exponential backoff: 2^attempt * base interval, capped at 60 minutes
    const attempt = (job.attemptsMade ?? 0) + 1;
    const backoffMinutes = Math.min(Math.pow(2, attempt) * integration.syncIntervalMin, 60);

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'ERROR',
        lastSyncError: message,
        nextSyncAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
        status: attempt >= 5 ? 'ERROR' : integration.status,
      },
    });

    throw err; // re-throw so BullMQ handles retries
  }
}

/**
 * Create and return the sync worker.
 * Concurrency: 10 for API-based, 3 for scrapers (handled via separate worker instances
 * if needed, but we use 5 as a balanced default).
 */
export function createSyncWorker(): Worker<SyncJobData> {
  const worker = new Worker<SyncJobData>(SYNC_QUEUE, processSyncJob, {
    connection: getRedis(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[sync-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[sync-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

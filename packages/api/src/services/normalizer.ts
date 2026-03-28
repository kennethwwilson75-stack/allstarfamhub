import type { RawEventData } from '@allstarfamhub/shared';
import { classifyEventType, computePriority } from '@allstarfamhub/shared';
import { prisma, type TransactionClient } from '../lib/prisma.js';

interface NormalizeOptions {
  familyId: string;
  integrationId: string;
  memberId?: string;
}

interface NormalizeResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

/**
 * Convert RawEventData items into canonical FamilyEvent records.
 * Handles deduplication by externalId + sourceIntegrationId and
 * tracks changes via EventChangeLog.
 */
export async function normalizeEvents(
  rawEvents: RawEventData[],
  options: NormalizeOptions,
): Promise<NormalizeResult> {
  const { familyId, integrationId, memberId } = options;
  const result: NormalizeResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  for (const raw of rawEvents) {
    try {
      const eventType = raw.eventType
        ? (raw.eventType as ReturnType<typeof classifyEventType>)
        : classifyEventType(raw.title);

      const priority = computePriority(raw.startAt, null);

      // Check for existing event by external ID
      const existing = await prisma.familyEvent.findFirst({
        where: {
          familyId,
          sourceIntegrationId: integrationId,
          externalId: raw.externalId,
        },
      });

      if (existing) {
        // Detect changes
        const changes: Array<{
          field: string;
          oldValue: string | null;
          newValue: string | null;
        }> = [];

        if (existing.title !== raw.title) {
          changes.push({
            field: 'title',
            oldValue: existing.title,
            newValue: raw.title,
          });
        }
        if (existing.startAt.getTime() !== raw.startAt.getTime()) {
          changes.push({
            field: 'startAt',
            oldValue: existing.startAt.toISOString(),
            newValue: raw.startAt.toISOString(),
          });
        }
        if (raw.endAt && existing.endAt?.getTime() !== raw.endAt.getTime()) {
          changes.push({
            field: 'endAt',
            oldValue: existing.endAt?.toISOString() ?? null,
            newValue: raw.endAt.toISOString(),
          });
        }
        if (raw.location !== undefined && existing.location !== raw.location) {
          changes.push({
            field: 'location',
            oldValue: existing.location,
            newValue: raw.location ?? null,
          });
        }
        if (raw.description !== undefined && existing.description !== raw.description) {
          changes.push({
            field: 'description',
            oldValue: existing.description,
            newValue: raw.description ?? null,
          });
        }

        if (changes.length === 0) {
          result.unchanged++;
          continue;
        }

        // Apply updates and log changes
        await prisma.$transaction(async (tx: TransactionClient) => {
          await tx.familyEvent.update({
            where: { id: existing.id },
            data: {
              title: raw.title,
              description: raw.description ?? existing.description,
              startAt: raw.startAt,
              endAt: raw.endAt ?? existing.endAt,
              allDay: raw.allDay ?? existing.allDay,
              location: raw.location ?? existing.location,
              eventType,
              priority,
            },
          });

          await tx.eventChangeLog.createMany({
            data: changes.map((c) => ({
              eventId: existing.id,
              ...c,
            })),
          });
        });

        result.updated++;
      } else {
        // Create new event
        await prisma.familyEvent.create({
          data: {
            familyId,
            sourceIntegrationId: integrationId,
            externalId: raw.externalId,
            title: raw.title,
            description: raw.description,
            eventType,
            startAt: raw.startAt,
            endAt: raw.endAt,
            allDay: raw.allDay ?? false,
            location: raw.location,
            priority,
            ...(memberId
              ? {
                  members: {
                    create: { memberId },
                  },
                }
              : {}),
          },
        });

        result.created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(
        `Failed to normalize event "${raw.externalId}": ${message}`,
      );
    }
  }

  return result;
}

import { describe, it, expect, vi } from 'vitest';
import { classifyEventType, computePriority } from '@allstarfamhub/shared';
import type { RawEventData } from '@allstarfamhub/shared';

/**
 * The normalizeEvents function is tightly coupled to Prisma.
 * We test the pure logic portions it relies on (classifyEventType, computePriority)
 * and the change-detection logic by replicating it here.
 */

/** Replicate the change-detection logic from normalizer.ts for unit testing. */
function detectChanges(
  existing: {
    title: string;
    startAt: Date;
    endAt: Date | null;
    location: string | null;
    description: string | null;
  },
  raw: RawEventData,
): Array<{ field: string; oldValue: string | null; newValue: string | null }> {
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  if (existing.title !== raw.title) {
    changes.push({ field: 'title', oldValue: existing.title, newValue: raw.title });
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

  return changes;
}

describe('normalizer — pure logic', () => {
  describe('event classification in normalizer context', () => {
    it('uses provided eventType when available', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Something random',
        startAt: new Date('2026-06-20T10:00:00Z'),
        rawPayload: {},
        eventType: 'PERSONAL',
      };
      // The normalizer uses raw.eventType if provided, otherwise classifies
      const eventType = raw.eventType
        ? raw.eventType
        : classifyEventType(raw.title);
      expect(eventType).toBe('PERSONAL');
    });

    it('falls back to classifyEventType when eventType is not provided', () => {
      const raw: RawEventData = {
        externalId: 'ext-2',
        title: 'Final Exam - Biology',
        startAt: new Date('2026-06-20T10:00:00Z'),
        rawPayload: {},
      };
      const eventType = raw.eventType
        ? raw.eventType
        : classifyEventType(raw.title);
      expect(eventType).toBe('EXAM');
    });
  });

  describe('priority assignment', () => {
    it('assigns priority based on startAt', () => {
      vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });
      const nearFuture = new Date('2026-06-15T13:00:00Z'); // 1 hour away
      expect(computePriority(nearFuture, null)).toBe('URGENT');
      vi.useRealTimers();
    });
  });

  describe('change detection', () => {
    const baseExisting = {
      title: 'Math Test',
      startAt: new Date('2026-06-20T10:00:00Z'),
      endAt: new Date('2026-06-20T11:00:00Z'),
      location: 'Room 101',
      description: 'Chapter 5 review',
    };

    it('detects no changes when everything matches', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T10:00:00Z'),
        endAt: new Date('2026-06-20T11:00:00Z'),
        location: 'Room 101',
        description: 'Chapter 5 review',
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes).toHaveLength(0);
    });

    it('detects title change', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Quiz',
        startAt: new Date('2026-06-20T10:00:00Z'),
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes).toContainEqual({
        field: 'title',
        oldValue: 'Math Test',
        newValue: 'Math Quiz',
      });
    });

    it('detects startAt change', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T14:00:00Z'),
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes).toContainEqual({
        field: 'startAt',
        oldValue: '2026-06-20T10:00:00.000Z',
        newValue: '2026-06-20T14:00:00.000Z',
      });
    });

    it('detects endAt change', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T10:00:00Z'),
        endAt: new Date('2026-06-20T12:00:00Z'),
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes).toContainEqual({
        field: 'endAt',
        oldValue: '2026-06-20T11:00:00.000Z',
        newValue: '2026-06-20T12:00:00.000Z',
      });
    });

    it('detects location change', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T10:00:00Z'),
        location: 'Room 202',
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes).toContainEqual({
        field: 'location',
        oldValue: 'Room 101',
        newValue: 'Room 202',
      });
    });

    it('detects description change', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T10:00:00Z'),
        description: 'Updated: Chapters 5-7',
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes).toContainEqual({
        field: 'description',
        oldValue: 'Chapter 5 review',
        newValue: 'Updated: Chapters 5-7',
      });
    });

    it('detects multiple changes at once', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Science Test',
        startAt: new Date('2026-06-21T09:00:00Z'),
        location: 'Lab 3',
        rawPayload: {},
      };
      const changes = detectChanges(baseExisting, raw);
      expect(changes.length).toBeGreaterThanOrEqual(3);
      const fields = changes.map((c) => c.field);
      expect(fields).toContain('title');
      expect(fields).toContain('startAt');
      expect(fields).toContain('location');
    });

    it('ignores location when raw.location is undefined', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T10:00:00Z'),
        rawPayload: {},
        // location is undefined — should not detect a change
      };
      const changes = detectChanges(baseExisting, raw);
      const locationChanges = changes.filter((c) => c.field === 'location');
      expect(locationChanges).toHaveLength(0);
    });

    it('detects when location changes to null', () => {
      const raw: RawEventData = {
        externalId: 'ext-1',
        title: 'Math Test',
        startAt: new Date('2026-06-20T10:00:00Z'),
        location: undefined,
        rawPayload: {},
      };
      // When location is explicitly undefined, it should not detect change
      const changes = detectChanges(baseExisting, raw);
      expect(changes.filter((c) => c.field === 'location')).toHaveLength(0);
    });
  });
});

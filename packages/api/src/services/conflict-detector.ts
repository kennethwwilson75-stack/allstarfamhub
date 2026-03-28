import { prisma } from '../lib/prisma.js';

export interface ConflictPair {
  eventA: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
  };
  eventB: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
  };
  memberId: string;
  memberName: string;
}

/**
 * Detect overlapping events for each member in a family.
 * Two events conflict when they share a member and their time ranges overlap.
 * Only checks upcoming active events (next 30 days by default).
 */
export async function detectConflicts(
  familyId: string,
  daysAhead = 30,
): Promise<ConflictPair[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Get all upcoming events with their member assignments
  const events = await prisma.familyEvent.findMany({
    where: {
      familyId,
      status: 'ACTIVE',
      startAt: { gte: now, lte: cutoff },
      allDay: false, // Skip all-day events for conflict detection
    },
    include: {
      members: {
        include: { member: true },
      },
    },
    orderBy: { startAt: 'asc' },
  });

  const conflicts: ConflictPair[] = [];
  const seen = new Set<string>();

  // Group events by member
  const memberEvents = new Map<
    string,
    Array<{
      id: string;
      title: string;
      startAt: Date;
      endAt: Date | null;
      memberName: string;
    }>
  >();

  for (const event of events) {
    for (const em of event.members) {
      const memberId = em.memberId;
      if (!memberEvents.has(memberId)) {
        memberEvents.set(memberId, []);
      }
      memberEvents.get(memberId)!.push({
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        memberName: em.member.displayName,
      });
    }
  }

  // Check for overlaps within each member's events
  for (const [memberId, memberEvts] of memberEvents) {
    for (let i = 0; i < memberEvts.length; i++) {
      for (let j = i + 1; j < memberEvts.length; j++) {
        const a = memberEvts[i]!;
        const b = memberEvts[j]!;

        if (eventsOverlap(a.startAt, a.endAt, b.startAt, b.endAt)) {
          // Dedup by sorted event pair
          const key = [a.id, b.id].sort().join(':') + ':' + memberId;
          if (!seen.has(key)) {
            seen.add(key);
            conflicts.push({
              eventA: {
                id: a.id,
                title: a.title,
                startAt: a.startAt,
                endAt: a.endAt,
              },
              eventB: {
                id: b.id,
                title: b.title,
                startAt: b.startAt,
                endAt: b.endAt,
              },
              memberId,
              memberName: a.memberName,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Check if two time ranges overlap.
 * If endAt is null, assumes 1-hour duration.
 */
function eventsOverlap(
  startA: Date,
  endA: Date | null,
  startB: Date,
  endB: Date | null,
): boolean {
  const DEFAULT_DURATION_MS = 60 * 60 * 1000; // 1 hour

  const effectiveEndA = endA ?? new Date(startA.getTime() + DEFAULT_DURATION_MS);
  const effectiveEndB = endB ?? new Date(startB.getTime() + DEFAULT_DURATION_MS);

  return startA < effectiveEndB && startB < effectiveEndA;
}

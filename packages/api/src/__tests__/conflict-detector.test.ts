import { describe, it, expect } from 'vitest';

/**
 * The detectConflicts function is DB-dependent (Prisma).
 * We test the overlap logic by replicating the eventsOverlap function
 * and testing the grouping/conflict-detection algorithm with in-memory data.
 */

/** Replicated from conflict-detector.ts */
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

interface SimpleEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
}

interface MemberAssignment {
  eventId: string;
  memberId: string;
  memberName: string;
}

interface ConflictPair {
  eventA: SimpleEvent;
  eventB: SimpleEvent;
  memberId: string;
  memberName: string;
}

/** Replicate the conflict detection algorithm from conflict-detector.ts */
function findConflicts(
  events: SimpleEvent[],
  assignments: MemberAssignment[],
): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  const seen = new Set<string>();

  // Group events by member
  const memberEvents = new Map<string, Array<SimpleEvent & { memberName: string }>>();

  for (const assignment of assignments) {
    const event = events.find((e) => e.id === assignment.eventId);
    if (!event) continue;

    if (!memberEvents.has(assignment.memberId)) {
      memberEvents.set(assignment.memberId, []);
    }
    memberEvents.get(assignment.memberId)!.push({
      ...event,
      memberName: assignment.memberName,
    });
  }

  for (const [memberId, memberEvts] of memberEvents) {
    for (let i = 0; i < memberEvts.length; i++) {
      for (let j = i + 1; j < memberEvts.length; j++) {
        const a = memberEvts[i]!;
        const b = memberEvts[j]!;

        if (eventsOverlap(a.startAt, a.endAt, b.startAt, b.endAt)) {
          const key = [a.id, b.id].sort().join(':') + ':' + memberId;
          if (!seen.has(key)) {
            seen.add(key);
            conflicts.push({
              eventA: { id: a.id, title: a.title, startAt: a.startAt, endAt: a.endAt },
              eventB: { id: b.id, title: b.title, startAt: b.startAt, endAt: b.endAt },
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

describe('eventsOverlap', () => {
  it('detects overlapping events', () => {
    expect(
      eventsOverlap(
        new Date('2026-06-15T10:00:00Z'),
        new Date('2026-06-15T12:00:00Z'),
        new Date('2026-06-15T11:00:00Z'),
        new Date('2026-06-15T13:00:00Z'),
      ),
    ).toBe(true);
  });

  it('returns false for non-overlapping events', () => {
    expect(
      eventsOverlap(
        new Date('2026-06-15T10:00:00Z'),
        new Date('2026-06-15T11:00:00Z'),
        new Date('2026-06-15T12:00:00Z'),
        new Date('2026-06-15T13:00:00Z'),
      ),
    ).toBe(false);
  });

  it('returns false for adjacent events (end equals start)', () => {
    expect(
      eventsOverlap(
        new Date('2026-06-15T10:00:00Z'),
        new Date('2026-06-15T11:00:00Z'),
        new Date('2026-06-15T11:00:00Z'),
        new Date('2026-06-15T12:00:00Z'),
      ),
    ).toBe(false);
  });

  it('assumes 1-hour duration when endAt is null', () => {
    // Event A: 10:00-11:00 (assumed), Event B: 10:30-11:30 (assumed)
    expect(
      eventsOverlap(
        new Date('2026-06-15T10:00:00Z'),
        null,
        new Date('2026-06-15T10:30:00Z'),
        null,
      ),
    ).toBe(true);
  });

  it('non-overlapping with null endAt', () => {
    // Event A: 10:00-11:00 (assumed), Event B: 12:00-13:00 (assumed)
    expect(
      eventsOverlap(
        new Date('2026-06-15T10:00:00Z'),
        null,
        new Date('2026-06-15T12:00:00Z'),
        null,
      ),
    ).toBe(false);
  });

  it('handles one event with endAt and one without', () => {
    expect(
      eventsOverlap(
        new Date('2026-06-15T10:00:00Z'),
        new Date('2026-06-15T12:00:00Z'),
        new Date('2026-06-15T11:30:00Z'),
        null, // assumed 1 hour: 11:30-12:30
      ),
    ).toBe(true);
  });

  it('detects fully contained event', () => {
    expect(
      eventsOverlap(
        new Date('2026-06-15T09:00:00Z'),
        new Date('2026-06-15T17:00:00Z'),
        new Date('2026-06-15T11:00:00Z'),
        new Date('2026-06-15T12:00:00Z'),
      ),
    ).toBe(true);
  });
});

describe('conflict detection algorithm', () => {
  it('detects conflicts for the same member with overlapping events', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Soccer Practice', startAt: new Date('2026-06-15T15:00:00Z'), endAt: new Date('2026-06-15T17:00:00Z') },
      { id: 'e2', title: 'Piano Lesson', startAt: new Date('2026-06-15T16:00:00Z'), endAt: new Date('2026-06-15T17:00:00Z') },
    ];
    const assignments: MemberAssignment[] = [
      { eventId: 'e1', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e2', memberId: 'member-1', memberName: 'Alice' },
    ];

    const conflicts = findConflicts(events, assignments);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.memberId).toBe('member-1');
    expect(conflicts[0]!.eventA.title).toBe('Soccer Practice');
    expect(conflicts[0]!.eventB.title).toBe('Piano Lesson');
  });

  it('does not flag non-overlapping events for the same member', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Soccer Practice', startAt: new Date('2026-06-15T15:00:00Z'), endAt: new Date('2026-06-15T16:00:00Z') },
      { id: 'e2', title: 'Piano Lesson', startAt: new Date('2026-06-15T17:00:00Z'), endAt: new Date('2026-06-15T18:00:00Z') },
    ];
    const assignments: MemberAssignment[] = [
      { eventId: 'e1', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e2', memberId: 'member-1', memberName: 'Alice' },
    ];

    const conflicts = findConflicts(events, assignments);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag overlapping events for different members', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Soccer Practice', startAt: new Date('2026-06-15T15:00:00Z'), endAt: new Date('2026-06-15T17:00:00Z') },
      { id: 'e2', title: 'Piano Lesson', startAt: new Date('2026-06-15T16:00:00Z'), endAt: new Date('2026-06-15T17:00:00Z') },
    ];
    const assignments: MemberAssignment[] = [
      { eventId: 'e1', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e2', memberId: 'member-2', memberName: 'Bob' },
    ];

    const conflicts = findConflicts(events, assignments);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflicts across multiple members independently', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Soccer', startAt: new Date('2026-06-15T15:00:00Z'), endAt: new Date('2026-06-15T17:00:00Z') },
      { id: 'e2', title: 'Piano', startAt: new Date('2026-06-15T16:00:00Z'), endAt: new Date('2026-06-15T17:00:00Z') },
      { id: 'e3', title: 'Art Class', startAt: new Date('2026-06-15T16:30:00Z'), endAt: new Date('2026-06-15T18:00:00Z') },
    ];
    const assignments: MemberAssignment[] = [
      // Alice has e1 and e2 (overlap)
      { eventId: 'e1', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e2', memberId: 'member-1', memberName: 'Alice' },
      // Bob has e2 and e3 (overlap)
      { eventId: 'e2', memberId: 'member-2', memberName: 'Bob' },
      { eventId: 'e3', memberId: 'member-2', memberName: 'Bob' },
    ];

    const conflicts = findConflicts(events, assignments);
    expect(conflicts).toHaveLength(2);
    const memberIds = conflicts.map((c) => c.memberId);
    expect(memberIds).toContain('member-1');
    expect(memberIds).toContain('member-2');
  });

  it('deduplicates conflict pairs', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Event A', startAt: new Date('2026-06-15T10:00:00Z'), endAt: new Date('2026-06-15T12:00:00Z') },
      { id: 'e2', title: 'Event B', startAt: new Date('2026-06-15T11:00:00Z'), endAt: new Date('2026-06-15T13:00:00Z') },
    ];
    const assignments: MemberAssignment[] = [
      { eventId: 'e1', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e2', memberId: 'member-1', memberName: 'Alice' },
    ];

    // Should only produce one conflict pair, not duplicates
    const conflicts = findConflicts(events, assignments);
    expect(conflicts).toHaveLength(1);
  });

  it('handles member assigned to both overlapping events (shared event)', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Family Dinner', startAt: new Date('2026-06-15T18:00:00Z'), endAt: new Date('2026-06-15T19:30:00Z') },
      { id: 'e2', title: 'Soccer Game', startAt: new Date('2026-06-15T19:00:00Z'), endAt: new Date('2026-06-15T20:30:00Z') },
    ];
    const assignments: MemberAssignment[] = [
      { eventId: 'e1', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e2', memberId: 'member-1', memberName: 'Alice' },
      { eventId: 'e1', memberId: 'member-2', memberName: 'Bob' },
      // Bob is NOT assigned to e2, so no conflict for Bob
    ];

    const conflicts = findConflicts(events, assignments);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.memberId).toBe('member-1');
  });

  it('handles empty events list', () => {
    const conflicts = findConflicts([], []);
    expect(conflicts).toHaveLength(0);
  });

  it('handles events with no member assignments', () => {
    const events: SimpleEvent[] = [
      { id: 'e1', title: 'Event A', startAt: new Date('2026-06-15T10:00:00Z'), endAt: new Date('2026-06-15T12:00:00Z') },
    ];
    const conflicts = findConflicts(events, []);
    expect(conflicts).toHaveLength(0);
  });
});

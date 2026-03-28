import { describe, it, expect, vi, afterEach } from 'vitest';
import { computePriority } from '../utils/priority.js';

describe('computePriority', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function fixedNow(): Date {
    return new Date('2026-06-15T12:00:00Z');
  }

  function hoursFromNow(hours: number): Date {
    return new Date(fixedNow().getTime() + hours * 60 * 60 * 1000);
  }

  it('returns URGENT for overdue events (in the past)', () => {
    vi.useFakeTimers({ now: fixedNow() });
    const pastDate = new Date(fixedNow().getTime() - 60 * 60 * 1000); // 1 hour ago
    expect(computePriority(pastDate)).toBe('URGENT');
  });

  it('returns URGENT for events less than 4 hours away', () => {
    vi.useFakeTimers({ now: fixedNow() });
    expect(computePriority(hoursFromNow(1))).toBe('URGENT');
    expect(computePriority(hoursFromNow(2))).toBe('URGENT');
    expect(computePriority(hoursFromNow(3))).toBe('URGENT');
    expect(computePriority(hoursFromNow(3.9))).toBe('URGENT');
  });

  it('returns HIGH for events less than 24 hours away but more than 4 hours', () => {
    vi.useFakeTimers({ now: fixedNow() });
    expect(computePriority(hoursFromNow(5))).toBe('HIGH');
    expect(computePriority(hoursFromNow(12))).toBe('HIGH');
    expect(computePriority(hoursFromNow(23))).toBe('HIGH');
  });

  it('returns NORMAL for events more than 24 hours away', () => {
    vi.useFakeTimers({ now: fixedNow() });
    expect(computePriority(hoursFromNow(25))).toBe('NORMAL');
    expect(computePriority(hoursFromNow(48))).toBe('NORMAL');
    expect(computePriority(hoursFromNow(168))).toBe('NORMAL');
  });

  it('uses deadlineAt over startAt when available', () => {
    vi.useFakeTimers({ now: fixedNow() });
    // startAt is far away, but deadline is soon
    const farStart = hoursFromNow(48);
    const soonDeadline = hoursFromNow(2);
    expect(computePriority(farStart, soonDeadline)).toBe('URGENT');
  });

  it('uses startAt when deadlineAt is null', () => {
    vi.useFakeTimers({ now: fixedNow() });
    expect(computePriority(hoursFromNow(5), null)).toBe('HIGH');
  });

  it('uses startAt when deadlineAt is undefined', () => {
    vi.useFakeTimers({ now: fixedNow() });
    expect(computePriority(hoursFromNow(5), undefined)).toBe('HIGH');
  });

  it('returns URGENT at the exact boundary (diff = 0)', () => {
    vi.useFakeTimers({ now: fixedNow() });
    // Event starts exactly now => diff = 0 which is < fourHours
    expect(computePriority(fixedNow())).toBe('URGENT');
  });
});

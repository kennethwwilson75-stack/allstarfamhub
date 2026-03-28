import { describe, it, expect } from 'vitest';
import { timeRangesOverlap, toDateString, getDayBounds } from '../utils/date.js';

describe('timeRangesOverlap', () => {
  it('detects overlapping ranges', () => {
    const a = { start: new Date('2026-06-15T10:00:00Z'), end: new Date('2026-06-15T12:00:00Z') };
    const b = { start: new Date('2026-06-15T11:00:00Z'), end: new Date('2026-06-15T13:00:00Z') };
    expect(timeRangesOverlap(a.start, a.end, b.start, b.end)).toBe(true);
  });

  it('detects non-overlapping ranges', () => {
    const a = { start: new Date('2026-06-15T10:00:00Z'), end: new Date('2026-06-15T11:00:00Z') };
    const b = { start: new Date('2026-06-15T12:00:00Z'), end: new Date('2026-06-15T13:00:00Z') };
    expect(timeRangesOverlap(a.start, a.end, b.start, b.end)).toBe(false);
  });

  it('treats adjacent ranges (end === start) as non-overlapping', () => {
    const a = { start: new Date('2026-06-15T10:00:00Z'), end: new Date('2026-06-15T11:00:00Z') };
    const b = { start: new Date('2026-06-15T11:00:00Z'), end: new Date('2026-06-15T12:00:00Z') };
    expect(timeRangesOverlap(a.start, a.end, b.start, b.end)).toBe(false);
  });

  it('detects when one range is fully contained in another', () => {
    const a = { start: new Date('2026-06-15T09:00:00Z'), end: new Date('2026-06-15T14:00:00Z') };
    const b = { start: new Date('2026-06-15T10:00:00Z'), end: new Date('2026-06-15T12:00:00Z') };
    expect(timeRangesOverlap(a.start, a.end, b.start, b.end)).toBe(true);
  });

  it('is symmetric — order of arguments does not matter', () => {
    const a = { start: new Date('2026-06-15T10:00:00Z'), end: new Date('2026-06-15T12:00:00Z') };
    const b = { start: new Date('2026-06-15T11:00:00Z'), end: new Date('2026-06-15T13:00:00Z') };
    expect(timeRangesOverlap(a.start, a.end, b.start, b.end)).toBe(
      timeRangesOverlap(b.start, b.end, a.start, a.end),
    );
  });

  it('detects overlap when ranges are identical', () => {
    const start = new Date('2026-06-15T10:00:00Z');
    const end = new Date('2026-06-15T12:00:00Z');
    expect(timeRangesOverlap(start, end, start, end)).toBe(true);
  });

  it('handles ranges spanning midnight', () => {
    const a = { start: new Date('2026-06-15T22:00:00Z'), end: new Date('2026-06-16T02:00:00Z') };
    const b = { start: new Date('2026-06-15T23:00:00Z'), end: new Date('2026-06-16T01:00:00Z') };
    expect(timeRangesOverlap(a.start, a.end, b.start, b.end)).toBe(true);
  });
});

describe('toDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateString(new Date('2026-06-15T10:30:00Z'))).toBe('2026-06-15');
  });

  it('handles start of year', () => {
    expect(toDateString(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });

  it('handles end of year', () => {
    expect(toDateString(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
  });

  it('handles leap year date', () => {
    expect(toDateString(new Date('2028-02-29T12:00:00Z'))).toBe('2028-02-29');
  });

  it('pads single-digit months and days', () => {
    expect(toDateString(new Date('2026-03-05T08:00:00Z'))).toBe('2026-03-05');
  });
});

describe('getDayBounds', () => {
  it('returns start and end of day', () => {
    const date = new Date('2026-06-15T15:00:00Z');
    const { start, end } = getDayBounds(date, 'UTC');
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  it('end is always after start', () => {
    const date = new Date('2026-06-15T15:00:00Z');
    const { start, end } = getDayBounds(date, 'UTC');
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('start and end represent the same calendar day', () => {
    const date = new Date('2026-06-15T15:00:00Z');
    const { start, end } = getDayBounds(date, 'UTC');
    // getDayBounds creates dates via `new Date("YYYY-MM-DDT00:00:00")` (local time).
    // Comparing the local date portions ensures same calendar day.
    expect(start.getFullYear()).toBe(end.getFullYear());
    expect(start.getMonth()).toBe(end.getMonth());
    expect(start.getDate()).toBe(end.getDate());
  });
});

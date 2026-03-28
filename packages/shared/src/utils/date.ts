/**
 * Check if two time ranges overlap.
 */
export function timeRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
export function toDateString(date: Date): string {
  const parts = date.toISOString().split('T');
  return parts[0] ?? '';
}

/**
 * Get start and end of day in a timezone.
 */
export function getDayBounds(date: Date, timezone: string): { start: Date; end: Date } {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone });
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
}

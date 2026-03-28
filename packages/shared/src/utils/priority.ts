import type { Priority } from '../types/enums.js';

/**
 * Determine event priority based on start time and deadline.
 */
export function computePriority(startAt: Date, deadlineAt?: Date | null): Priority {
  const now = new Date();
  const fourHours = 4 * 60 * 60 * 1000;
  const twentyFourHours = 24 * 60 * 60 * 1000;

  const relevantTime = deadlineAt ?? startAt;
  const diff = relevantTime.getTime() - now.getTime();

  if (diff < 0) return 'URGENT'; // overdue
  if (diff < fourHours) return 'URGENT';
  if (diff < twentyFourHours) return 'HIGH';
  return 'NORMAL';
}

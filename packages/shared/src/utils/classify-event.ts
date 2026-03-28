import { EVENT_TYPE_KEYWORDS } from './constants.js';
import type { EventType } from '../types/enums.js';

/**
 * Classify an event title into an EventType using keyword matching.
 * Returns 'ANNOUNCEMENT' if no keywords match.
 */
export function classifyEventType(title: string): EventType {
  const lower = title.toLowerCase();

  for (const [eventType, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return eventType as EventType;
      }
    }
  }

  return 'ANNOUNCEMENT';
}

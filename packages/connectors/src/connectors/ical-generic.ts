import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
  RawEventData,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

export const icalGenericConnector: Connector = {
  id: 'ical-generic',
  displayName: 'iCal Calendar Feed',
  methods: [IntegrationMethod.ICAL_FEED],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    if (!creds.feedUrl) {
      return { valid: false, error: 'Calendar feed URL is required' };
    }
    try {
      const url = new URL(creds.feedUrl);
      if (!url.protocol.startsWith('http')) {
        return { valid: false, error: 'Feed URL must use HTTP(S)' };
      }
      // Attempt a HEAD request to verify accessibility
      const res = await fetch(creds.feedUrl, { method: 'HEAD' });
      if (!res.ok) {
        return { valid: false, error: `Feed URL returned status ${String(res.status)}` };
      }
      return { valid: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid feed URL';
      return { valid: false, error: msg };
    }
  },

  async sync(config: ConnectorConfig): Promise<ConnectorResult> {
    const { feedUrl } = config.credentials;
    if (!feedUrl) {
      return { events: [], announcements: [], errors: ['No feed URL configured'] };
    }

    const errors: string[] = [];
    let events: RawEventData[] = [];

    try {
      const res = await fetch(feedUrl);
      if (!res.ok) {
        return {
          events: [],
          announcements: [],
          errors: [`Feed fetch failed: ${String(res.status)} ${res.statusText}`],
        };
      }

      const icsText = await res.text();
      events = parseIcs(icsText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'iCal fetch error';
      errors.push(msg);
    }

    return {
      events,
      announcements: [],
      errors,
      nextSyncRecommendedAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    };
  },
};

/**
 * Parse iCal (.ics) text into RawEventData.
 * Deduplicates by VEVENT UID.
 */
function parseIcs(icsText: string): RawEventData[] {
  const events: RawEventData[] = [];
  const seenUids = new Set<string>();

  const vevents = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i] ?? '';
    const endIdx = block.indexOf('END:VEVENT');
    const content = endIdx >= 0 ? block.substring(0, endIdx) : block;

    // Unfold continued lines (RFC 5545: lines starting with space/tab are continuations)
    const unfolded = content.replace(/\r?\n[ \t]/g, '');

    const uid = extractField(unfolded, 'UID');
    const summary = extractField(unfolded, 'SUMMARY');
    const dtstart = extractField(unfolded, 'DTSTART');
    const dtend = extractField(unfolded, 'DTEND');
    const description = extractField(unfolded, 'DESCRIPTION');
    const location = extractField(unfolded, 'LOCATION');
    const status = extractField(unfolded, 'STATUS');

    if (!uid || !summary || !dtstart) continue;

    // Deduplicate by UID
    if (seenUids.has(uid)) continue;
    seenUids.add(uid);

    // Skip cancelled events
    if (status?.toUpperCase() === 'CANCELLED') continue;

    const isAllDay = dtstart.length === 8;

    events.push({
      externalId: `ical-${uid}`,
      title: unescapeIcsText(summary),
      description: description ? unescapeIcsText(description) : undefined,
      startAt: parseIcsDate(dtstart),
      endAt: dtend ? parseIcsDate(dtend) : undefined,
      allDay: isAllDay,
      location: location ? unescapeIcsText(location) : undefined,
      eventType: 'SCHOOL_EVENT',
      rawPayload: { uid, summary, dtstart, dtend, description, location, status },
    });
  }

  return events;
}

function extractField(block: string, field: string): string | null {
  // Match field name with optional parameters (e.g., DTSTART;VALUE=DATE:20240101)
  const regex = new RegExp(`^${field}[^:]*:(.+)$`, 'm');
  const match = regex.exec(block);
  return match?.[1]?.trim() ?? null;
}

function parseIcsDate(value: string): Date {
  // YYYYMMDD format (all-day)
  if (value.length === 8) {
    return new Date(`${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`);
  }
  // YYYYMMDDTHHmmSS or YYYYMMDDTHHmmSSZ
  const cleaned = value.replace(/[^0-9TZ]/g, '');
  if (cleaned.length >= 15) {
    const y = cleaned.substring(0, 4);
    const m = cleaned.substring(4, 6);
    const d = cleaned.substring(6, 8);
    const h = cleaned.substring(9, 11);
    const min = cleaned.substring(11, 13);
    const s = cleaned.substring(13, 15);
    const isUtc = value.endsWith('Z');
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}${isUtc ? 'Z' : ''}`);
  }
  return new Date(value);
}

/** Unescape iCal text values */
function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

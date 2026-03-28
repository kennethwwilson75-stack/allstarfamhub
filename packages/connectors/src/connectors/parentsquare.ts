import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
  RawEventData,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

/**
 * ParentSquare connector supporting iCal feeds, email parsing, and web scraping.
 *
 * Preferred method order:
 * 1. ICAL_FEED — if the school exposes a calendar feed URL
 * 2. EMAIL_PARSE — forward ParentSquare notification emails
 * 3. WEB_SCRAPE — login and scrape the dashboard (Playwright worker)
 */
export const parentSquareConnector: Connector = {
  id: 'parentsquare',
  displayName: 'ParentSquare',
  methods: [IntegrationMethod.ICAL_FEED, IntegrationMethod.EMAIL_PARSE, IntegrationMethod.WEB_SCRAPE],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    // If using iCal, feedUrl is required
    if (creds.feedUrl) {
      try {
        const url = new URL(creds.feedUrl);
        if (!url.protocol.startsWith('http')) {
          return { valid: false, error: 'Feed URL must use HTTP(S)' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid feed URL' };
      }
    }

    // If using scraper, username/password required
    if (creds.username && creds.password) {
      return { valid: true };
    }

    // Email parse needs no special credentials (handled by email ingestion pipeline)
    if (creds.customFields?.['emailParseEnabled'] === 'true') {
      return { valid: true };
    }

    return { valid: false, error: 'Provide a feed URL, login credentials, or enable email parsing' };
  },

  async sync(config: ConnectorConfig): Promise<ConnectorResult> {
    const { credentials } = config;
    const events: RawEventData[] = [];
    const announcements: RawEventData[] = [];
    const errors: string[] = [];

    // Strategy 1: iCal feed
    if (credentials.feedUrl) {
      try {
        const res = await fetch(credentials.feedUrl);
        if (!res.ok) {
          errors.push(`iCal fetch failed: ${String(res.status)} ${res.statusText}`);
        } else {
          const icsText = await res.text();
          const parsed = parseIcsBasic(icsText);
          events.push(...parsed);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'iCal fetch error';
        errors.push(msg);
      }

      return {
        events,
        announcements,
        errors,
        nextSyncRecommendedAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      };
    }

    // Strategy 2: Web scrape fallback
    if (credentials.username && credentials.password) {
      throw new Error(
        'WEB_SCRAPE_REQUIRED: ParentSquare web scraping must be executed in the Playwright scraper worker.',
      );
    }

    // Strategy 3: Email parse — events come through the email ingestion pipeline
    // Nothing to actively sync; events arrive via the email parser
    return {
      events,
      announcements,
      errors: errors.length > 0 ? errors : ['No active sync method configured'],
      nextSyncRecommendedAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };
  },
};

/** Minimal iCal VEVENT parser — extracts basic fields from .ics text */
function parseIcsBasic(icsText: string): RawEventData[] {
  const events: RawEventData[] = [];
  const vevents = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i] ?? '';
    const endIdx = block.indexOf('END:VEVENT');
    const content = endIdx >= 0 ? block.substring(0, endIdx) : block;

    const uid = extractIcsField(content, 'UID');
    const summary = extractIcsField(content, 'SUMMARY');
    const dtstart = extractIcsField(content, 'DTSTART');
    const dtend = extractIcsField(content, 'DTEND');
    const description = extractIcsField(content, 'DESCRIPTION');
    const location = extractIcsField(content, 'LOCATION');

    if (uid && summary && dtstart) {
      events.push({
        externalId: `parentsquare-${uid}`,
        title: summary,
        description: description ?? undefined,
        startAt: parseIcsDate(dtstart),
        endAt: dtend ? parseIcsDate(dtend) : undefined,
        allDay: dtstart.length === 8, // YYYYMMDD = all-day
        location: location ?? undefined,
        eventType: 'SCHOOL_EVENT',
        rawPayload: { uid, summary, dtstart, dtend, description, location },
      });
    }
  }

  return events;
}

function extractIcsField(block: string, field: string): string | null {
  // Match field with optional parameters (e.g., DTSTART;VALUE=DATE:20240101)
  const regex = new RegExp(`^${field}[^:]*:(.+)$`, 'm');
  const match = regex.exec(block);
  return match?.[1]?.trim() ?? null;
}

function parseIcsDate(value: string): Date {
  // Handles YYYYMMDD and YYYYMMDDTHHmmSSZ formats
  if (value.length === 8) {
    return new Date(`${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`);
  }
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

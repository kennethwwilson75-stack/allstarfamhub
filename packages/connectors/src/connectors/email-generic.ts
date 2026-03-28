import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

/**
 * Generic email parser connector.
 *
 * This connector does not actively pull data. Instead, emails are forwarded
 * to the platform's email ingestion pipeline (e.g., via SendGrid Inbound Parse
 * or similar service). The pipeline calls this connector's parsing utilities
 * to extract events from email bodies.
 *
 * The sync method is a no-op — events arrive asynchronously via email.
 */
export const emailGenericConnector: Connector = {
  id: 'email-generic',
  displayName: 'Email Forwarding',
  methods: [IntegrationMethod.EMAIL_PARSE],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    // Email parsing requires a forwarding address to be configured.
    // The customFields should contain the unique inbound email address.
    const forwardAddress = creds.customFields?.['forwardAddress'];
    if (!forwardAddress) {
      return { valid: false, error: 'A forwarding email address must be configured' };
    }

    // Basic email format check
    if (!forwardAddress.includes('@')) {
      return { valid: false, error: 'Invalid forwarding email address' };
    }

    return { valid: true };
  },

  async sync(_config: ConnectorConfig): Promise<ConnectorResult> {
    // Email-based connectors are passive — events arrive via the email
    // ingestion pipeline. There is nothing to actively pull.
    return {
      events: [],
      announcements: [],
      errors: [],
      nextSyncRecommendedAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours (passive)
    };
  },
};

/**
 * Utility: extract date-like patterns from email text.
 * Used by the email ingestion pipeline, not by sync() directly.
 */
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];

  // Match patterns like "January 15, 2024" or "Jan 15 2024"
  const monthDayYear = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s*(\d{4})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = monthDayYear.exec(text)) !== null) {
    const dateStr = `${match[1] ?? ''} ${match[2] ?? ''}, ${match[3] ?? ''}`;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      dates.push(parsed);
    }
  }

  // Match patterns like "12/15/2024" or "2024-12-15"
  const numericDate = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((match = numericDate.exec(text)) !== null) {
    const parsed = new Date(`${match[1] ?? ''}/${match[2] ?? ''}/${match[3] ?? ''}`);
    if (!isNaN(parsed.getTime())) {
      dates.push(parsed);
    }
  }

  return dates;
}

/**
 * Utility: extract time-like patterns from email text.
 */
export function extractTimesFromText(text: string): string[] {
  const times: string[] = [];

  // Match patterns like "3:30 PM", "15:30", "3pm"
  const timePattern = /\b(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\b/g;
  let match: RegExpExecArray | null;
  while ((match = timePattern.exec(text)) !== null) {
    const hour = parseInt(match[1] ?? '0', 10);
    const minute = match[2] ?? '00';
    const ampm = match[3] ?? '';
    if (hour >= 0 && hour <= 23) {
      times.push(`${String(hour)}:${minute}${ampm ? ` ${ampm}` : ''}`);
    }
  }

  return times;
}

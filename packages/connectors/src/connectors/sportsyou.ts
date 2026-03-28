import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

/** Keywords that indicate a cancellation in SportsYou messages */
const CANCELLATION_KEYWORDS = [
  'cancelled',
  'canceled',
  'cancel',
  'called off',
  'postponed',
  'rained out',
  'weather cancel',
];

/** Keywords that indicate a reschedule in SportsYou messages */
const RESCHEDULE_KEYWORDS = [
  'rescheduled',
  'reschedule',
  'moved to',
  'changed to',
  'new time',
  'new date',
  'updated time',
  'updated date',
];

/**
 * Detect if a message indicates cancellation or rescheduling.
 * Exported for use by the email ingestion pipeline.
 */
export function detectEventChange(text: string): 'CANCELLED' | 'RESCHEDULED' | null {
  const lower = text.toLowerCase();

  for (const keyword of CANCELLATION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'CANCELLED';
    }
  }

  for (const keyword of RESCHEDULE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'RESCHEDULED';
    }
  }

  return null;
}

export const sportsYouConnector: Connector = {
  id: 'sportsyou',
  displayName: 'SportsYou',
  methods: [IntegrationMethod.EMAIL_PARSE, IntegrationMethod.WEB_SCRAPE],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    // Email parse mode — no credentials needed beyond config flag
    if (creds.customFields?.['emailParseEnabled'] === 'true') {
      return { valid: true };
    }

    // Web scrape mode — needs login
    if (creds.username && creds.password) {
      return { valid: true };
    }

    return { valid: false, error: 'Provide login credentials or enable email parsing' };
  },

  async sync(_config: ConnectorConfig): Promise<ConnectorResult> {
    // SportsYou does not expose a public API.
    // Email-based events arrive through the email ingestion pipeline.
    // Web scraping requires Playwright worker.

    if (_config.credentials.username && _config.credentials.password) {
      throw new Error(
        'WEB_SCRAPE_REQUIRED: SportsYou web scraping must be executed in the Playwright scraper worker. ' +
        'Steps: 1) Login at sportsyou.com, 2) Navigate to team calendar, 3) Scrape event cards. ' +
        'Parse cancellation/rescheduling keywords from event descriptions.',
      );
    }

    // Email parse mode — nothing to actively pull; events arrive via email pipeline
    return {
      events: [],
      announcements: [],
      errors: [],
      nextSyncRecommendedAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };
  },
};

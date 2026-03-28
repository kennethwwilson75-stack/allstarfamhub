import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

export const remindConnector: Connector = {
  id: 'remind',
  displayName: 'Remind',
  methods: [IntegrationMethod.EMAIL_PARSE, IntegrationMethod.WEB_SCRAPE],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    // Email parse mode
    if (creds.customFields?.['emailParseEnabled'] === 'true') {
      return { valid: true };
    }

    // Web scrape mode
    if (creds.username && creds.password) {
      return { valid: true };
    }

    return { valid: false, error: 'Provide login credentials or enable email parsing' };
  },

  async sync(_config: ConnectorConfig): Promise<ConnectorResult> {
    if (_config.credentials.username && _config.credentials.password) {
      throw new Error(
        'WEB_SCRAPE_REQUIRED: Remind web scraping must be executed in the Playwright scraper worker. ' +
        'Steps: 1) Login at remind.com, 2) Navigate to classes/groups, 3) Scrape messages and events.',
      );
    }

    // Email parse mode — events arrive via the email ingestion pipeline
    return {
      events: [],
      announcements: [],
      errors: [],
      nextSyncRecommendedAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  },
};

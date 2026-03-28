import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

export const blackboardConnector: Connector = {
  id: 'blackboard',
  displayName: 'Blackboard',
  methods: [IntegrationMethod.WEB_SCRAPE],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    if (!creds.username || !creds.password) {
      return { valid: false, error: 'Username and password are required' };
    }
    return { valid: true };
  },

  async sync(_config: ConnectorConfig): Promise<ConnectorResult> {
    throw new Error(
      'WEB_SCRAPE_REQUIRED: Blackboard sync must be executed in the Playwright scraper worker. ' +
      'Steps: 1) Login at institution Blackboard portal, 2) Navigate to calendar/course list, ' +
      '3) Scrape assignments and events. Detect CAPTCHA/MFA and return ERROR status if encountered.',
    );
  },
};

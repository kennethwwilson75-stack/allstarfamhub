import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

export const infiniteCampusConnector: Connector = {
  id: 'infinite-campus',
  displayName: 'Infinite Campus',
  methods: [IntegrationMethod.WEB_SCRAPE],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    if (!creds.username || !creds.password) {
      return { valid: false, error: 'Username and password are required' };
    }
    // Full validation requires Playwright — accept credentials structurally
    return { valid: true };
  },

  async sync(_config: ConnectorConfig): Promise<ConnectorResult> {
    // Infinite Campus requires Playwright-based scraping.
    // Actual scraping runs in an isolated Docker worker.
    // This method is called by the worker with scraped data, or throws
    // to signal that the orchestrator should dispatch to the scraper worker.
    throw new Error(
      'WEB_SCRAPE_REQUIRED: Infinite Campus sync must be executed in the Playwright scraper worker. ' +
      'Steps: 1) Login at district portal, 2) Navigate to Calendar, 3) Scrape event rows. ' +
      'Detect CAPTCHA/MFA and return ERROR status if encountered.',
    );
  },
};

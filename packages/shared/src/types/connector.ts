import type { IntegrationMethod } from './enums.js';

export interface ConnectorCredentials {
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  feedUrl?: string;
  customFields?: Record<string, string>;
}

export interface RawEventData {
  externalId: string;
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date;
  allDay?: boolean;
  location?: string;
  eventType?: string;
  rawPayload: Record<string, unknown>;
}

export interface ConnectorResult {
  events: RawEventData[];
  announcements: RawEventData[];
  errors: string[];
  nextSyncRecommendedAt?: Date;
}

export interface ConnectorConfig {
  integrationId: string;
  familyId: string;
  memberId?: string;
  credentials: ConnectorCredentials;
  scraperConfig?: Record<string, unknown>;
  lastSyncAt?: Date;
}

export interface Connector {
  id: string;
  displayName: string;
  methods: IntegrationMethod[];

  validateCredentials(
    creds: ConnectorCredentials,
  ): Promise<{ valid: boolean; error?: string }>;

  sync(config: ConnectorConfig): Promise<ConnectorResult>;

  getAuthUrl?(state: string): string;
  exchangeCode?(code: string): Promise<ConnectorCredentials>;
  refreshTokens?(creds: ConnectorCredentials): Promise<ConnectorCredentials>;
}

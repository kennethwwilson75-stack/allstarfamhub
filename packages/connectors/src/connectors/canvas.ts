import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
  RawEventData,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

const CANVAS_CLIENT_ID = process.env['CANVAS_CLIENT_ID'] ?? '';
const CANVAS_CLIENT_SECRET = process.env['CANVAS_CLIENT_SECRET'] ?? '';
const CANVAS_REDIRECT_URI = process.env['CANVAS_REDIRECT_URI'] ?? '';

/** Default forward sync window in days */
const SYNC_WINDOW_DAYS = 90;

function getInstanceUrl(config: ConnectorConfig): string {
  const url = config.scraperConfig?.['instanceUrl'];
  if (typeof url !== 'string' || !url) {
    throw new Error('Canvas instanceUrl is required in scraperConfig');
  }
  return url.replace(/\/$/, '');
}

async function canvasFetch(
  instanceUrl: string,
  path: string,
  token: string,
): Promise<Response> {
  const res = await fetch(`${instanceUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    throw new Error('EXPIRED');
  }

  if (res.status === 403) {
    throw new Error('Canvas API: forbidden — check token scopes');
  }

  // Handle rate limiting
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 10;
    throw new Error(`Canvas API rate limited — retry after ${String(waitSeconds)}s`);
  }

  if (!res.ok) {
    throw new Error(`Canvas API error: ${String(res.status)} ${res.statusText}`);
  }

  return res;
}

export const canvasConnector: Connector = {
  id: 'canvas',
  displayName: 'Canvas LMS',
  methods: [IntegrationMethod.OAUTH_API],

  getAuthUrl(state: string): string {
    // instanceUrl must be provided out-of-band; use a default or require config
    const instanceUrl = process.env['CANVAS_INSTANCE_URL'] ?? 'https://canvas.instructure.com';
    const params = new URLSearchParams({
      client_id: CANVAS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: CANVAS_REDIRECT_URI,
      state,
      scope: 'url:GET|/api/v1/calendar_events url:GET|/api/v1/courses',
    });
    return `${instanceUrl}/login/oauth2/auth?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<ConnectorCredentials> {
    const instanceUrl = process.env['CANVAS_INSTANCE_URL'] ?? 'https://canvas.instructure.com';
    const res = await fetch(`${instanceUrl}/login/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CANVAS_CLIENT_ID,
        client_secret: CANVAS_CLIENT_SECRET,
        redirect_uri: CANVAS_REDIRECT_URI,
        code,
      }),
    });

    if (!res.ok) {
      throw new Error(`Canvas token exchange failed: ${String(res.status)}`);
    }

    const data = await res.json() as { access_token: string; refresh_token?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  },

  async refreshTokens(creds: ConnectorCredentials): Promise<ConnectorCredentials> {
    if (!creds.refreshToken) {
      throw new Error('No refresh token available');
    }
    const instanceUrl = process.env['CANVAS_INSTANCE_URL'] ?? 'https://canvas.instructure.com';
    const res = await fetch(`${instanceUrl}/login/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CANVAS_CLIENT_ID,
        client_secret: CANVAS_CLIENT_SECRET,
        refresh_token: creds.refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Canvas token refresh failed: ${String(res.status)}`);
    }

    const data = await res.json() as { access_token: string; refresh_token?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? creds.refreshToken,
    };
  },

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    if (!creds.accessToken) {
      return { valid: false, error: 'Access token is required' };
    }
    try {
      const instanceUrl = process.env['CANVAS_INSTANCE_URL'] ?? 'https://canvas.instructure.com';
      await canvasFetch(instanceUrl, '/api/v1/users/self', creds.accessToken);
      return { valid: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { valid: false, error: message };
    }
  },

  async sync(config: ConnectorConfig): Promise<ConnectorResult> {
    const token = config.credentials.accessToken;
    if (!token) {
      return { events: [], announcements: [], errors: ['No access token provided'] };
    }

    const instanceUrl = getInstanceUrl(config);
    const events: RawEventData[] = [];
    const errors: string[] = [];

    const now = new Date();
    const endDate = new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const startDate = config.lastSyncAt ?? now;

    const params = new URLSearchParams({
      type: 'event',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      per_page: '100',
    });

    try {
      // Fetch calendar events
      const eventsRes = await canvasFetch(
        instanceUrl,
        `/api/v1/calendar_events?${params.toString()}`,
        token,
      );
      const calendarEvents = await eventsRes.json() as Array<{
        id: number;
        title: string;
        description?: string;
        start_at?: string;
        end_at?: string;
        all_day?: boolean;
        location_name?: string;
      }>;

      for (const evt of calendarEvents) {
        events.push({
          externalId: `canvas-event-${String(evt.id)}`,
          title: evt.title,
          description: evt.description ?? undefined,
          startAt: new Date(evt.start_at ?? now.toISOString()),
          endAt: evt.end_at ? new Date(evt.end_at) : undefined,
          allDay: evt.all_day ?? false,
          location: evt.location_name ?? undefined,
          eventType: 'SCHOOL_EVENT',
          rawPayload: evt as unknown as Record<string, unknown>,
        });
      }

      // Fetch assignments as events
      const assignmentParams = new URLSearchParams({
        type: 'assignment',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        per_page: '100',
      });

      const assignmentsRes = await canvasFetch(
        instanceUrl,
        `/api/v1/calendar_events?${assignmentParams.toString()}`,
        token,
      );
      const assignments = await assignmentsRes.json() as Array<{
        id: number;
        title: string;
        description?: string;
        start_at?: string;
        end_at?: string;
        all_day?: boolean;
        assignment?: { due_at?: string };
      }>;

      for (const a of assignments) {
        const dueAt = a.assignment?.due_at ?? a.end_at ?? a.start_at;
        events.push({
          externalId: `canvas-assignment-${String(a.id)}`,
          title: a.title,
          description: a.description ?? undefined,
          startAt: new Date(dueAt ?? now.toISOString()),
          endAt: dueAt ? new Date(dueAt) : undefined,
          allDay: a.all_day ?? false,
          eventType: 'ASSIGNMENT',
          rawPayload: a as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Canvas sync error';
      errors.push(message);
    }

    return {
      events,
      announcements: [],
      errors,
      nextSyncRecommendedAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 min
    };
  },
};

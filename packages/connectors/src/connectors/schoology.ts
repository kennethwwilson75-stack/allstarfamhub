import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
  RawEventData,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';
import { createHmac } from 'node:crypto';

const SCHOOLOGY_CONSUMER_KEY = process.env['SCHOOLOGY_CONSUMER_KEY'] ?? '';
const SCHOOLOGY_CONSUMER_SECRET = process.env['SCHOOLOGY_CONSUMER_SECRET'] ?? '';

/**
 * Generate OAuth 1.0a signature for Schoology API requests.
 */
function generateOAuth1Header(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  tokenKey: string,
  tokenSecret: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: tokenKey,
    oauth_version: '1.0',
  };

  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k] ?? '')}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  params['oauth_signature'] = signature;

  const headerParts = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k] ?? '')}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

async function schoologyFetch(
  path: string,
  tokenKey: string,
  tokenSecret: string,
): Promise<Response> {
  const url = `https://api.schoology.com/v1${path}`;
  const authHeader = generateOAuth1Header(
    'GET',
    url,
    SCHOOLOGY_CONSUMER_KEY,
    SCHOOLOGY_CONSUMER_SECRET,
    tokenKey,
    tokenSecret,
  );

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    throw new Error('EXPIRED');
  }

  if (res.status === 429) {
    throw new Error('Schoology API rate limited — retry later');
  }

  if (!res.ok) {
    throw new Error(`Schoology API error: ${String(res.status)} ${res.statusText}`);
  }

  return res;
}

interface SchoologyCourse {
  id: number;
  title: string;
}

interface SchoologyEvent {
  id: number;
  title: string;
  description?: string;
  start: string;
  end?: string;
  has_end: number;
  type: string;
}

export const schoologyConnector: Connector = {
  id: 'schoology',
  displayName: 'Schoology (PowerSchool Learning)',
  methods: [IntegrationMethod.OAUTH_API],

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    if (!creds.accessToken) {
      return { valid: false, error: 'OAuth access token is required' };
    }
    const tokenSecret = creds.customFields?.['tokenSecret'];
    if (!tokenSecret) {
      return { valid: false, error: 'OAuth token secret is required in customFields.tokenSecret' };
    }
    try {
      await schoologyFetch('/users/me', creds.accessToken, tokenSecret);
      return { valid: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { valid: false, error: message };
    }
  },

  async sync(config: ConnectorConfig): Promise<ConnectorResult> {
    const token = config.credentials.accessToken;
    const tokenSecret = config.credentials.customFields?.['tokenSecret'];

    if (!token || !tokenSecret) {
      return { events: [], announcements: [], errors: ['OAuth token and token secret are required'] };
    }

    const events: RawEventData[] = [];
    const errors: string[] = [];

    try {
      // Get user's courses
      const coursesRes = await schoologyFetch('/users/me/sections', token, tokenSecret);
      const coursesData = await coursesRes.json() as { section?: SchoologyCourse[] };
      const courses = coursesData.section ?? [];

      // Get events from each course
      for (const course of courses) {
        try {
          const eventsRes = await schoologyFetch(
            `/sections/${String(course.id)}/events?start=0&limit=100`,
            token,
            tokenSecret,
          );
          const eventsData = await eventsRes.json() as { event?: SchoologyEvent[] };
          const courseEvents = eventsData.event ?? [];

          for (const evt of courseEvents) {
            events.push({
              externalId: `schoology-${String(evt.id)}`,
              title: `${course.title}: ${evt.title}`,
              description: evt.description ?? undefined,
              startAt: new Date(evt.start),
              endAt: evt.has_end && evt.end ? new Date(evt.end) : undefined,
              eventType: evt.type === 'assignment' ? 'ASSIGNMENT' : 'SCHOOL_EVENT',
              rawPayload: evt as unknown as Record<string, unknown>,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'events fetch error';
          errors.push(`Course ${course.title}: ${msg}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Schoology sync error';
      errors.push(message);
    }

    return {
      events,
      announcements: [],
      errors,
      nextSyncRecommendedAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  },
};

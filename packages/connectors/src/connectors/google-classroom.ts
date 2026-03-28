import type {
  Connector,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorResult,
  RawEventData,
} from '@allstarfamhub/shared';
import { IntegrationMethod } from '@allstarfamhub/shared';

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] ?? '';
const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'] ?? '';
const GOOGLE_REDIRECT_URI = process.env['GOOGLE_REDIRECT_URI'] ?? '';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
].join(' ');

async function googleApiFetch(path: string, token: string): Promise<Response> {
  const res = await fetch(`https://classroom.googleapis.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    throw new Error('EXPIRED');
  }

  if (res.status === 429) {
    throw new Error('Google API rate limited — retry later');
  }

  if (!res.ok) {
    throw new Error(`Google Classroom API error: ${String(res.status)} ${res.statusText}`);
  }

  return res;
}

interface GoogleCourse {
  id: string;
  name: string;
  courseState: string;
}

interface GoogleCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  alternateLink?: string;
}

interface GoogleAnnouncement {
  id: string;
  courseId: string;
  text: string;
  creationTime: string;
}

export const googleClassroomConnector: Connector = {
  id: 'google-classroom',
  displayName: 'Google Classroom',
  methods: [IntegrationMethod.OAUTH_API],

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<ConnectorCredentials> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      throw new Error(`Google token exchange failed: ${String(res.status)}`);
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

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: creds.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      throw new Error(`Google token refresh failed: ${String(res.status)}`);
    }

    const data = await res.json() as { access_token: string };
    return {
      accessToken: data.access_token,
      refreshToken: creds.refreshToken, // Google doesn't rotate refresh tokens
    };
  },

  async validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }> {
    if (!creds.accessToken) {
      return { valid: false, error: 'Access token is required' };
    }
    try {
      await googleApiFetch('/v1/courses?pageSize=1', creds.accessToken);
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

    const events: RawEventData[] = [];
    const announcements: RawEventData[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Get active courses
      const coursesRes = await googleApiFetch(
        '/v1/courses?courseStates=ACTIVE&pageSize=50',
        token,
      );
      const coursesData = await coursesRes.json() as { courses?: GoogleCourse[] };
      const courses = coursesData.courses ?? [];

      for (const course of courses) {
        // Step 2: Get courseWork (assignments) per course
        try {
          const cwRes = await googleApiFetch(
            `/v1/courses/${course.id}/courseWork?pageSize=100&orderBy=dueDate asc`,
            token,
          );
          const cwData = await cwRes.json() as { courseWork?: GoogleCourseWork[] };
          const courseWork = cwData.courseWork ?? [];

          for (const cw of courseWork) {
            const dueDate = buildDueDate(cw.dueDate, cw.dueTime);
            events.push({
              externalId: `gclass-cw-${cw.courseId}-${cw.id}`,
              title: `${course.name}: ${cw.title}`,
              description: cw.description ?? undefined,
              startAt: dueDate ?? new Date(),
              endAt: dueDate ?? undefined,
              allDay: !cw.dueTime,
              eventType: 'ASSIGNMENT',
              rawPayload: cw as unknown as Record<string, unknown>,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'courseWork fetch error';
          errors.push(`Course ${course.name}: ${msg}`);
        }

        // Step 3: Get announcements per course
        try {
          const annRes = await googleApiFetch(
            `/v1/courses/${course.id}/announcements?pageSize=20&orderBy=updateTime desc`,
            token,
          );
          const annData = await annRes.json() as { announcements?: GoogleAnnouncement[] };
          const anns = annData.announcements ?? [];

          for (const ann of anns) {
            announcements.push({
              externalId: `gclass-ann-${ann.courseId}-${ann.id}`,
              title: `${course.name}: Announcement`,
              description: ann.text,
              startAt: new Date(ann.creationTime),
              eventType: 'ANNOUNCEMENT',
              rawPayload: ann as unknown as Record<string, unknown>,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'announcements fetch error';
          errors.push(`Course ${course.name} announcements: ${msg}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Google Classroom sync error';
      errors.push(message);
    }

    return {
      events,
      announcements,
      errors,
      nextSyncRecommendedAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    };
  },
};

function buildDueDate(
  date?: { year: number; month: number; day: number },
  time?: { hours?: number; minutes?: number },
): Date | null {
  if (!date) return null;
  const d = new Date(date.year, date.month - 1, date.day);
  if (time) {
    d.setHours(time.hours ?? 23, time.minutes ?? 59, 0, 0);
  }
  return d;
}

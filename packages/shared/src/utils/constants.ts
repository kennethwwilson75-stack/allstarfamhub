export const LLM_DAILY_CAPS: Record<string, number> = {
  FREE: 0,
  PER_AGENT: 50,
  FAMILY: 200,
  DISTRICT: 500,
};

export const SYNC_INTERVALS: Record<string, { api: number; scraper: number }> = {
  FREE: { api: 30, scraper: 30 },
  PER_AGENT: { api: 15, scraper: 15 },
  FAMILY: { api: 5, scraper: 10 },
  DISTRICT: { api: 5, scraper: 10 },
};

export const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  ASSIGNMENT: ['due', 'assignment', 'submit', 'homework', 'project', 'essay', 'lab report', 'quiz'],
  EXAM: ['exam', 'test', 'midterm', 'final', 'assessment'],
  NO_SCHOOL: [
    'no school',
    'holiday',
    'pd day',
    'teacher workday',
    'snow day',
    'break',
    'closed',
  ],
  SPORTS: ['game', 'practice', 'match', 'tournament', 'meet', 'scrimmage', 'tryout'],
  MEETING: ['conference', 'meeting', 'iep', '504', 'counselor', 'orientation'],
  SCHOOL_EVENT: [
    'field trip',
    'picture',
    'concert',
    'play',
    'graduation',
    'prom',
    'homecoming',
  ],
};

export const MEMBER_COLORS = [
  '#1D9E75',
  '#378ADD',
  '#D85A30',
  '#EF9F27',
  '#534AB7',
  '#E24B4A',
];

export const SOURCE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  canvas: { bg: '#E6F1FB', text: '#185FA5' },
  'infinite-campus': { bg: '#FAECE7', text: '#993C1D' },
  parentsquare: { bg: '#EEEDFE', text: '#534AB7' },
  sportsyou: { bg: '#FAEEDA', text: '#854F0B' },
  'google-classroom': { bg: '#EAF3DE', text: '#3B6D11' },
  remind: { bg: '#FEF3CD', text: '#856404' },
  blackboard: { bg: '#F0F0F0', text: '#333333' },
  schoology: { bg: '#E8F5E9', text: '#2E7D32' },
  family: { bg: '#E1F5EE', text: '#1D9E75' },
};

export const RATE_LIMITS = {
  auth_login: { windowMs: 60_000, max: 5, blockDurationMs: 900_000 },
  auth_register: { windowMs: 3_600_000, max: 3, blockDurationMs: 86_400_000 },
  api_general: { windowMs: 60_000, max: 100, blockDurationMs: 300_000 },
  api_sync_force: { windowMs: 3_600_000, max: 10, blockDurationMs: 3_600_000 },
  webhook_ingest: { windowMs: 60_000, max: 1000, blockDurationMs: 60_000 },
} as const;

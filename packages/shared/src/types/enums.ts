export const Plan = {
  FREE: 'FREE',
  PER_AGENT: 'PER_AGENT',
  FAMILY: 'FAMILY',
  DISTRICT: 'DISTRICT',
} as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

export const MemberRole = {
  ADMIN: 'ADMIN',
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const IntegrationMethod = {
  OAUTH_API: 'OAUTH_API',
  ICAL_FEED: 'ICAL_FEED',
  EMAIL_PARSE: 'EMAIL_PARSE',
  WEB_SCRAPE: 'WEB_SCRAPE',
  MANUAL: 'MANUAL',
} as const;
export type IntegrationMethod = (typeof IntegrationMethod)[keyof typeof IntegrationMethod];

export const IntegrationStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  ERROR: 'ERROR',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
} as const;
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

export const EventType = {
  ASSIGNMENT: 'ASSIGNMENT',
  EXAM: 'EXAM',
  SCHOOL_EVENT: 'SCHOOL_EVENT',
  NO_SCHOOL: 'NO_SCHOOL',
  SPORTS: 'SPORTS',
  MEETING: 'MEETING',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  PERSONAL: 'PERSONAL',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const EventStatus = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  COMPLETED: 'COMPLETED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const AlertType = {
  EVENT_ADDED: 'EVENT_ADDED',
  EVENT_CHANGED: 'EVENT_CHANGED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  LOCATION_CHANGED: 'LOCATION_CHANGED',
  TIME_CHANGED: 'TIME_CHANGED',
  DEADLINE_TOMORROW: 'DEADLINE_TOMORROW',
  DEADLINE_TODAY: 'DEADLINE_TODAY',
  GRADE_POSTED: 'GRADE_POSTED',
  SIGNUP_NEEDED: 'SIGNUP_NEEDED',
  SYNC_ERROR: 'SYNC_ERROR',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

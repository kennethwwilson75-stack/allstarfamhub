import type { MemberRole, IntegrationMethod, EventType, Priority } from './enums.js';

// Auth
export interface RegisterRequest {
  email: string;
  password: string;
  familyName: string;
  displayName: string;
  timezone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    familyId: string;
    role: MemberRole;
  };
}

// Family
export interface CreateFamilyRequest {
  name: string;
  timezone?: string;
}

export interface UpdateFamilyRequest {
  name?: string;
  timezone?: string;
}

// Members
export interface AddMemberRequest {
  displayName: string;
  role: MemberRole;
  color?: string;
  grade?: string;
  schoolName?: string;
}

export interface UpdateMemberRequest {
  displayName?: string;
  role?: MemberRole;
  color?: string;
  grade?: string;
  schoolName?: string;
  avatarUrl?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: MemberRole;
}

// Integrations
export interface CreateIntegrationRequest {
  connectorId: string;
  memberId?: string;
  method: IntegrationMethod;
  displayName: string;
  credentials?: {
    username?: string;
    password?: string;
    feedUrl?: string;
    customFields?: Record<string, string>;
  };
  scraperConfig?: Record<string, unknown>;
}

export interface UpdateIntegrationRequest {
  displayName?: string;
  status?: 'ACTIVE' | 'PAUSED';
  syncIntervalMin?: number;
  scraperConfig?: Record<string, unknown>;
}

// Events
export interface CreateEventRequest {
  title: string;
  startAt: string; // ISO 8601
  endAt?: string;
  allDay?: boolean;
  eventType?: EventType;
  location?: string;
  description?: string;
  memberIds?: string[];
  priority?: Priority;
  deadlineAt?: string;
}

export interface UpdateEventRequest {
  title?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  eventType?: EventType;
  location?: string;
  description?: string;
  memberIds?: string[];
  priority?: Priority;
  status?: 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
}

export interface EventsQuery {
  memberId?: string;
  start?: string; // ISO date
  end?: string;
  type?: EventType;
  limit?: number;
  offset?: number;
}

// Alerts
export interface AlertsQuery {
  unread?: boolean;
  memberId?: string;
  limit?: number;
  offset?: number;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

// WebSocket
export interface WsMessage {
  type: 'ALERT' | 'EVENT_UPDATE' | 'SYNC_COMPLETE';
  data: Record<string, unknown>;
}

// Request context (attached by auth middleware)
export interface RequestContext {
  userId: string;
  familyId: string;
  role: MemberRole;
}

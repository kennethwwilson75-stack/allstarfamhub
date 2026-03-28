import type {
  Plan,
  MemberRole,
  IntegrationMethod,
  IntegrationStatus,
  EventType,
  Priority,
  EventStatus,
  AlertType,
} from './enums.js';

export interface Family {
  id: string;
  name: string;
  timezone: string;
  plan: Plan;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string | null;
  role: MemberRole;
  displayName: string;
  color: string;
  avatarUrl: string | null;
  grade: string | null;
  schoolName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  supabaseId: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: Date;
}

export interface FamilyInvite {
  id: string;
  familyId: string;
  email: string;
  role: MemberRole;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface Integration {
  id: string;
  familyId: string;
  memberId: string | null;
  connectorId: string;
  method: IntegrationMethod;
  status: IntegrationStatus;
  displayName: string;
  credentialsEnc: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  feedUrl: string | null;
  ingestEmail: string | null;
  scraperConfig: Record<string, unknown> | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  nextSyncAt: Date | null;
  syncIntervalMin: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawItem {
  id: string;
  integrationId: string;
  sourceId: string;
  rawPayload: Record<string, unknown>;
  parsedAt: Date | null;
  parseError: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export interface FamilyEvent {
  id: string;
  familyId: string;
  sourceIntegrationId: string | null;
  sourceItemId: string | null;
  externalId: string | null;
  title: string;
  description: string | null;
  eventType: EventType;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  timezone: string | null;
  location: string | null;
  locationUrl: string | null;
  isRecurring: boolean;
  recurringRule: string | null;
  priority: Priority;
  status: EventStatus;
  deadlineAt: Date | null;
  gradeWeight: number | null;
  requiresSignup: boolean;
  signupUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventMember {
  eventId: string;
  memberId: string;
}

export interface EventChangeLog {
  id: string;
  eventId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
}

export interface Alert {
  id: string;
  familyId: string;
  eventId: string | null;
  type: AlertType;
  title: string;
  body: string;
  priority: Priority;
  readAt: Date | null;
  dismissedAt: Date | null;
  actionUrl: string | null;
  createdAt: Date;
}

export interface ConnectorDefinition {
  id: string;
  displayName: string;
  category: string;
  logoUrl: string | null;
  description: string | null;
  methods: string[];
  oauthConfigJson: Record<string, unknown> | null;
  icalInstructions: string | null;
  emailInstructions: string | null;
  scraperAvailable: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventReminder {
  id: string;
  eventId: string;
  userId: string;
  minutesBefore: number;
  sent: boolean;
  sentAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferences {
  id: string;
  familyId: string;
  memberId: string | null;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  notifyEventAdded: boolean;
  notifyEventChanged: boolean;
  notifyLocationChanged: boolean;
  notifyDeadlineToday: boolean;
  notifyDeadlineTomorrow: boolean;
  notifyGradePosted: boolean;
  notifyConflict: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
}

export interface LlmUsage {
  id: string;
  familyId: string;
  date: string;
  callCount: number;
  tokenCount: number;
  costUsdMil: number;
  createdAt: Date;
  updatedAt: Date;
}

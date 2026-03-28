# All Star Fam Hub — Complete Product Specification
**Version:** 1.0  
**Status:** Build-Ready  
**Audience:** Claude Code (autonomous build agent)  
**Last Updated:** 2026-03-28

---

## PRIME DIRECTIVE FOR CLAUDE CODE

Build this application completely, autonomously, and production-ready. Do not ask for clarification unless a blocker is truly unresolvable. Make opinionated decisions where the spec leaves gaps. Every section marked **[BUILD]** requires working code. Every section marked **[CONFIG]** requires a file on disk. Every section marked **[SCHEMA]** requires a database migration. The goal is a fully running application at the end, not scaffolding.

---

## 1. Product Overview

**All Star Fam Hub** is a unified family scheduling intelligence platform. It consolidates calendars, alerts, announcements, and schedule changes from every school, sports, and education platform a family uses — Canvas, Infinite Campus, ParentSquare, SportsYou, Google Classroom, Remind, Blackboard, Schoology, and more — into a single, proactively updated family calendar with smart alerts.

### Core Value Proposition
- One calendar for the whole family, fed automatically from every platform the school uses
- Proactive alerts when things change (game location moved, assignment added, no-school day announced)
- Per-member views (mom sees everything; Emma sees only her events; Jake sees only his)
- Works even when platforms lack APIs — via authenticated web scraping and email parsing

### Scale Targets
- 10,000 registered families at launch capacity
- 50,000 at Year 1 capacity
- Sub-200ms API response time at p95
- Scraper workers: horizontally scalable, target <5 min data freshness per family

---

## 2. Technology Stack

### Backend
- **Runtime:** Node.js 20 LTS with TypeScript
- **Framework:** Fastify (not Express — faster, better TypeScript support)
- **Database:** PostgreSQL 15 via Supabase (managed, includes auth, row-level security)
- **Cache / Queue:** Redis (Upstash for managed, or self-hosted on Railway)
- **Job Queue:** BullMQ on Redis — for scraper jobs, email parsing jobs, notification dispatch
- **ORM:** Prisma (type-safe, migration-friendly)
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Email Ingest:** SendGrid Inbound Parse webhook (for email-forward integration method)
- **Push Notifications:** Firebase Cloud Messaging (FCM) for mobile; Web Push for PWA
- **Scraping:** Playwright (headless Chromium) — containerized workers
- **LLM Parsing:** Anthropic Claude API (`claude-haiku-3` for cost-efficient email/text parsing)
- **Deployment:** Railway (backend + workers + Redis), Supabase (DB + Auth)

### Frontend — Web
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui components
- **State:** Zustand for client state, TanStack Query for server state
- **Calendar UI:** FullCalendar (open source, feature-complete)
- **Deployment:** Vercel

### Frontend — Mobile
- **Framework:** React Native with Expo SDK 51
- **Navigation:** Expo Router (file-based)
- **Notifications:** Expo Notifications (wraps FCM + APNs)
- **Deployment:** EAS Build → App Store + Google Play

### Infrastructure
```
allstarfamhub/
├── apps/
│   ├── web/          # Next.js web app
│   └── mobile/       # Expo React Native app
├── packages/
│   ├── api/          # Fastify backend
│   ├── workers/      # BullMQ job processors (scrapers, parsers, notifier)
│   ├── shared/       # Shared TypeScript types, schemas, utils
│   └── connectors/   # Integration connector plugins (one per platform)
├── prisma/           # Database schema + migrations
├── docker/           # Dockerfiles for workers
└── scripts/          # Dev setup, seed scripts
```

Use **pnpm workspaces** as the monorepo manager.

---

## 2.5 Agent Subscription Model [BUILD]

All Star Fam Hub is built around the concept of **agents working for your family**. Each integration source is not a "connector" in the UI — it is a named, subscribable **Agent** with a persona, status, and track record.

```typescript
// Agent UX framing (UI/copy guidelines):
// - "Canvas Agent" not "Canvas Integration"
// - "Your SportsYou Agent is working..." not "Syncing SportsYou..."
// - "Jake's Soccer Agent found a schedule change" not "SportsYou sync returned updated event"
// - Agent card shows: avatar (platform logo), name, last active, events found this week, status

// Agent subscription flow:
// 1. Family opens "Add Agent" screen
// 2. Sees grid of available agents with logos and descriptions
// 3. Taps agent → sees what it does, what it needs, what it costs
// 4. "Subscribe" → credential entry or OAuth → test run → live
// 5. Agent immediately runs first sync, shows "Found X events for [member]"

// Agent status states (shown on agent card):
// 🟢 Active — syncing normally, last sync timestamp
// 🟡 Needs Attention — credential issue, CAPTCHA encountered, re-auth needed
// 🔴 Paused — user paused it or plan limit reached
// ⚙️  Learning — first sync in progress

// Free tier: 1 agent, family's choice (shown clearly at signup)
// Per-agent tier: $1.99/month per additional agent
// Family unlimited: $14.99/month or $119.99/year — all agents

// Plan enforcement in DB:
// Before allowing new integration: check family.plan and count active integrations
// If over limit: block with clear upgrade prompt — never silently fail
// Agents paused due to plan downgrade: retain all data, show "Resume for $1.99/mo"
```



Run all migrations via Prisma. Every table has `created_at` and `updated_at` with automatic timestamps.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Core Identity ───────────────────────────────────────────────

model Family {
  id            String   @id @default(cuid())
  name          String
  timezone      String   @default("America/New_York")
  plan          Plan     @default(FREE)
  stripeCustomerId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  members       FamilyMember[]
  integrations  Integration[]
  events        FamilyEvent[]
  alerts        Alert[]
  invites       FamilyInvite[]
}

enum Plan {
  FREE        // 1 agent, no LLM parsing
  PER_AGENT   // $1.99/agent/month, LLM capped at 50/day
  FAMILY      // $14.99/month unlimited, LLM capped at 200/day
  DISTRICT    // district-licensed, LLM capped at 500/day per family
}

model FamilyMember {
  id          String       @id @default(cuid())
  familyId    String
  userId      String?      // null if child without own account
  role        MemberRole   @default(CHILD)
  displayName String
  color       String       @default("#1D9E75")  // hex, for calendar display
  avatarUrl   String?
  grade       String?      // "6", "10", "K", etc.
  schoolName  String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  family      Family       @relation(fields: [familyId], references: [id], onDelete: Cascade)
  user        User?        @relation(fields: [userId], references: [id])
  events      EventMember[]
  integrations Integration[]

  @@index([familyId])
  @@index([userId])
}

enum MemberRole {
  ADMIN   // parent/guardian — full access
  PARENT  // parent — full access, no billing
  CHILD   // read-only on their own events
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  supabaseId    String   @unique
  displayName   String?
  pushTokens    PushToken[]
  members       FamilyMember[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model PushToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  platform  String   // "ios" | "android" | "web"
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model FamilyInvite {
  id        String   @id @default(cuid())
  familyId  String
  email     String
  role      MemberRole
  token     String   @unique @default(cuid())
  expiresAt DateTime
  usedAt    DateTime?
  family    Family   @relation(fields: [familyId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// ─── Integrations ────────────────────────────────────────────────

model Integration {
  id              String            @id @default(cuid())
  familyId        String
  memberId        String?           // null = applies to whole family
  connectorId     String            // e.g. "canvas", "parentsquare", "sportsyou"
  method          IntegrationMethod
  status          IntegrationStatus @default(PENDING)
  displayName     String            // user-visible label, e.g. "Emma's Canvas"
  
  // Credentials (encrypted at rest)
  credentialsEnc  String?           // AES-256-GCM encrypted JSON blob
  
  // OAuth tokens
  accessToken     String?
  refreshToken    String?
  tokenExpiresAt  DateTime?
  
  // iCal / RSS feeds
  feedUrl         String?
  
  // Email ingest
  ingestEmail     String?           // the @ingest.allstarfamhub.com address assigned
  
  // Scraper config
  scraperConfig   Json?             // connector-specific config (URLs, selectors, etc)
  
  // Sync state
  lastSyncAt      DateTime?
  lastSyncStatus  String?
  lastSyncError   String?
  nextSyncAt      DateTime?
  syncIntervalMin Int               @default(15)
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  family          Family            @relation(fields: [familyId], references: [id], onDelete: Cascade)
  member          FamilyMember?     @relation(fields: [memberId], references: [id])
  rawItems        RawItem[]

  @@index([familyId])
  @@index([connectorId])
  @@index([nextSyncAt])  // for job scheduler queries
}

enum IntegrationMethod {
  OAUTH_API     // native API with OAuth
  ICAL_FEED     // subscribe to .ics URL
  EMAIL_PARSE   // parse inbound forwarded emails
  WEB_SCRAPE    // authenticated Playwright scraping
  MANUAL        // user manually adds events
}

enum IntegrationStatus {
  PENDING       // needs user to complete auth
  ACTIVE        // syncing normally
  ERROR         // last sync failed
  PAUSED        // user-paused
  EXPIRED       // credentials expired, needs re-auth
}

// ─── Raw Ingestion Layer ──────────────────────────────────────────

model RawItem {
  id              String      @id @default(cuid())
  integrationId   String
  sourceId        String      // ID from the source system (dedup key)
  rawPayload      Json        // full raw data from source
  parsedAt        DateTime?
  parseError      String?
  processedAt     DateTime?
  integration     Integration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  createdAt       DateTime    @default(now())

  @@unique([integrationId, sourceId])   // prevents duplicate ingestion
  @@index([integrationId])
  @@index([processedAt])
}

// ─── Canonical Events ────────────────────────────────────────────

model FamilyEvent {
  id              String      @id @default(cuid())
  familyId        String
  sourceIntegrationId String?
  sourceItemId    String?     // RawItem.id that produced this event
  externalId      String?     // ID from source system (for update matching)
  
  title           String
  description     String?
  eventType       EventType
  
  startAt         DateTime
  endAt           DateTime?
  allDay          Boolean     @default(false)
  timezone        String?
  
  location        String?
  locationUrl     String?
  
  isRecurring     Boolean     @default(false)
  recurringRule   String?     // iCal RRULE string
  
  priority        Priority    @default(NORMAL)
  status          EventStatus @default(ACTIVE)
  
  // Smart conflict / deadline metadata
  deadlineAt      DateTime?   // for assignments: the due date
  gradeWeight     Float?      // % of grade, if parseable
  requiresSignup  Boolean     @default(false)
  signupUrl       String?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  family          Family      @relation(fields: [familyId], references: [id], onDelete: Cascade)
  members         EventMember[]
  alerts          Alert[]
  changeLog       EventChangeLog[]

  @@index([familyId])
  @@index([startAt])
  @@index([familyId, startAt])
  @@index([externalId, sourceIntegrationId])
}

enum EventType {
  ASSIGNMENT      // school assignment/homework due
  EXAM            // test, quiz, midterm, final
  SCHOOL_EVENT    // field trip, picture day, concert, play
  NO_SCHOOL       // holiday, PD day, snow day
  SPORTS          // game, practice, tournament
  MEETING         // parent-teacher conf, IEP, counselor
  ANNOUNCEMENT    // general info, no date action needed
  PERSONAL        // manually added by family
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT          // same-day or overdue
}

enum EventStatus {
  ACTIVE
  CANCELLED
  RESCHEDULED     // has a linked replacement event
  COMPLETED
}

model EventMember {
  eventId   String
  memberId  String
  event     FamilyEvent  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  member    FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@id([eventId, memberId])
}

model EventChangeLog {
  id          String      @id @default(cuid())
  eventId     String
  field       String      // "location", "startAt", "title", etc.
  oldValue    String?
  newValue    String?
  changedAt   DateTime    @default(now())
  event       FamilyEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId])
}

// ─── Alerts & Notifications ───────────────────────────────────────

model Alert {
  id          String      @id @default(cuid())
  familyId    String
  eventId     String?
  type        AlertType
  title       String
  body        String
  priority    Priority    @default(NORMAL)
  readAt      DateTime?
  dismissedAt DateTime?
  actionUrl   String?
  createdAt   DateTime    @default(now())

  family      Family      @relation(fields: [familyId], references: [id], onDelete: Cascade)
  event       FamilyEvent? @relation(fields: [eventId], references: [id])

  @@index([familyId, createdAt])
  @@index([familyId, readAt])
}

enum AlertType {
  EVENT_ADDED
  EVENT_CHANGED     // any field changed
  EVENT_CANCELLED
  LOCATION_CHANGED  // high priority — game/event moved
  TIME_CHANGED      // high priority — time shift
  DEADLINE_TOMORROW
  DEADLINE_TODAY
  GRADE_POSTED
  SIGNUP_NEEDED     // form/permission slip requires action
  SYNC_ERROR        // integration stopped working
  CONFLICT_DETECTED // two events same time for same member
}

// ─── Connector Registry ───────────────────────────────────────────

model ConnectorDefinition {
  id              String   @id   // e.g. "canvas", "parentsquare"
  displayName     String
  category        String        // "lms", "sports", "school_comms", "gradebook"
  logoUrl         String?
  description     String?
  methods         String[]      // available integration methods
  oauthConfigJson Json?         // client_id, scopes, auth_url, token_url
  icalInstructions String?      // markdown instructions for finding iCal URL
  emailInstructions String?     // how to set up email forwarding
  scraperAvailable Boolean @default(false)
  isActive        Boolean @default(true)
  sortOrder       Int     @default(100)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 4. Connector Plugin Architecture [BUILD]

This is the most critical architectural piece. Every integration source is a **Connector Plugin** — a TypeScript module conforming to a standard interface. The job system calls connectors generically; adding a new connector never requires touching core code.

### 4.1 Connector Interface

```typescript
// packages/connectors/src/types.ts

export interface ConnectorCredentials {
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  feedUrl?: string;
  customFields?: Record<string, string>;
}

export interface RawEventData {
  externalId: string;         // unique ID within this source
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date;
  allDay?: boolean;
  location?: string;
  eventType?: string;         // hint for normalizer
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
  
  // Validate credentials before saving
  validateCredentials(creds: ConnectorCredentials): Promise<{ valid: boolean; error?: string }>;
  
  // Main sync method — returns normalized raw events
  sync(config: ConnectorConfig): Promise<ConnectorResult>;
  
  // OAuth connectors only
  getAuthUrl?(state: string): string;
  exchangeCode?(code: string): Promise<ConnectorCredentials>;
  refreshTokens?(creds: ConnectorCredentials): Promise<ConnectorCredentials>;
}
```

### 4.2 Connector Registry

```typescript
// packages/connectors/src/registry.ts

import { canvasConnector } from './connectors/canvas';
import { parentsquareConnector } from './connectors/parentsquare';
import { sportsyouConnector } from './connectors/sportsyou';
import { infiniteCampusConnector } from './connectors/infinite-campus';
import { googleClassroomConnector } from './connectors/google-classroom';
import { remindConnector } from './connectors/remind';
import { blackboardConnector } from './connectors/blackboard';
import { schoologyConnector } from './connectors/schoology';
import { icalConnector } from './connectors/ical-generic';
import { emailConnector } from './connectors/email-generic';

const connectors: Map<string, Connector> = new Map([
  ['canvas', canvasConnector],
  ['parentsquare', parentsquareConnector],
  ['sportsyou', sportsyouConnector],
  ['infinite-campus', infiniteCampusConnector],
  ['google-classroom', googleClassroomConnector],
  ['remind', remindConnector],
  ['blackboard', blackboardConnector],
  ['schoology', schoologyConnector],
  ['ical-generic', icalConnector],
  ['email-generic', emailConnector],
]);

export function getConnector(id: string): Connector {
  const connector = connectors.get(id);
  if (!connector) throw new Error(`Unknown connector: ${id}`);
  return connector;
}

export function listConnectors(): Connector[] {
  return Array.from(connectors.values());
}
```

### 4.3 Individual Connector Implementations [BUILD]

Build each connector as a separate file. Below are the full specs for each:

#### Canvas LMS (OAuth API)
```typescript
// packages/connectors/src/connectors/canvas.ts
// Canvas has a real public REST API with OAuth2
// Docs: https://canvas.instructure.com/doc/api/

// Auth: OAuth2 — redirect to {instance}/login/oauth2/auth
// Required scopes: url:GET|/api/v1/calendar_events, url:GET|/api/v1/courses, url:GET|/api/v1/assignments

// Endpoints to hit:
// GET /api/v1/calendar_events?type=event&start_date={}&end_date={}&per_page=100
// GET /api/v1/calendar_events?type=assignment&start_date={}&end_date={}&per_page=100
// GET /api/v1/courses (to get course names for labeling)

// Canvas is multi-tenant: the base URL varies by district/school
// Store base URL in scraperConfig.instanceUrl
// Example: https://myschool.instructure.com

// Sync window: pull 90 days forward from now on each sync
// Rate limit: respect X-Request-Cost and X-Rate-Limit-Remaining headers
// On 401: mark integration as EXPIRED, trigger re-auth alert
```

#### Infinite Campus (District API + Scraper fallback)
```typescript
// packages/connectors/src/connectors/infinite-campus.ts
// Infinite Campus has a Campus API but requires district opt-in
// Fallback: authenticated web scraping via Playwright

// Web scraping approach:
// 1. Navigate to district's IC URL (store in scraperConfig.instanceUrl)
// 2. Login with student/parent credentials
// 3. Navigate to Campus > Calendar
// 4. Scrape the monthly calendar view, parse events
// 5. Navigate to Grades section, extract grade data if available
// 6. Also scrape Announcements/Messages section

// Selectors (common across IC versions, but store in scraperConfig for overrides):
// Login form: #username, #password, #btn-login or equivalent
// Calendar container: .ic-calendar, .calendar-grid
// Event items: .event-item, .calendar-event

// Session management: store cookies in Redis with TTL=8h
// Re-login when session expires (detect by redirect to login page)
// Run scraper every 15 minutes per integration

// Scraper must handle:
// - CAPTCHA detection: if CAPTCHA appears, mark as ERROR and alert user
// - MFA: if MFA prompt appears, mark as NEEDS_REAUTH
// - Maintenance windows: retry with exponential backoff
```

#### ParentSquare (iCal + Email + Scraper)
```typescript
// packages/connectors/src/connectors/parentsquare.ts
// ParentSquare has no public API
// Three methods, use best available:

// Method 1: iCal Feed (preferred)
// ParentSquare exports calendar as iCal
// User must find this URL in ParentSquare > Calendar > Subscribe
// Store URL in integration.feedUrl
// Fetch and parse every 15 minutes

// Method 2: Email Forwarding
// User forwards ParentSquare emails to their ingest@allstarfamhub.com address
// Parse email body using Claude API
// Extract: event name, date/time, location, description, action items

// Method 3: Authenticated Scraping (fallback)
// Login to app.parentsquare.com with parent credentials
// Scrape /groups/{school_id}/posts (announcement feed)
// Scrape /groups/{school_id}/calendar (event calendar)
// Parse post cards for event dates and times

// All three methods can run in parallel; deduplicate by title+date
```

#### SportsYou (Email + Scraper)
```typescript
// packages/connectors/src/connectors/sportsyou.ts
// SportsYou has no public API

// Method 1: Email Forwarding (primary)
// Coach posts update → SportsYou sends email to parent
// Parent forwards to ingest@allstarfamhub.com
// Parse with Claude: extract game time, location, opponent, cancellation/reschedule

// Method 2: Authenticated Scraping
// Login to app.sportsyou.com (or mobile API endpoints)
// Endpoints discovered via network inspection:
// GET /api/v3/teams/{team_id}/calendar
// GET /api/v3/teams/{team_id}/events
// Store team_id in scraperConfig after initial login + team discovery
// Auth: bearer token from login, refresh as needed

// Key parsing rules:
// "Practice cancelled" → mark existing practice event CANCELLED
// "Game moved to" → update existing event location/time, fire LOCATION_CHANGED alert
// "Game postponed" → mark RESCHEDULED
// Scrape every 10 minutes (sports updates are time-sensitive)
```

#### Google Classroom (OAuth API)
```typescript
// packages/connectors/src/connectors/google-classroom.ts
// Full Google OAuth2 with official API
// Scopes: https://www.googleapis.com/auth/classroom.courses.readonly
//         https://www.googleapis.com/auth/classroom.coursework.me.readonly
//         https://www.googleapis.com/auth/classroom.announcements.readonly

// Endpoints:
// GET https://classroom.googleapis.com/v1/courses
// GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWork
// GET https://classroom.googleapis.com/v1/courses/{courseId}/announcements

// Map courseWork to EventType.ASSIGNMENT
// Map announcements to EventType.ANNOUNCEMENT
// dueDate field maps to deadlineAt
// maxPoints maps to gradeWeight context
```

#### Remind (Email + Scraper)
```typescript
// packages/connectors/src/connectors/remind.ts
// Remind sends SMS and email notifications
// Method 1: Email forwarding → parse with Claude
// Method 2: If user shares Remind login: scrape app.remind.com
//   - Login, navigate to each class/group
//   - Extract messages and any attached dates
// Remind messages rarely have structured event data — use Claude to extract:
//   "Early release Wednesday at 1pm" → EventType.SCHOOL_EVENT, date=next Wednesday, time=13:00
```

#### Blackboard (Scraper + possible LTI)
```typescript
// packages/connectors/src/connectors/blackboard.ts
// Scrape: login to institution's Blackboard URL
// Navigate to Calendar view
// Scrape course announcements and due dates
// Store instanceUrl in scraperConfig
```

#### Schoology (OAuth API)
```typescript
// packages/connectors/src/connectors/schoology.ts
// Schoology has an OAuth1.0a API
// GET /v1/users/{uid}/events
// GET /v1/users/{uid}/grades (if scope granted)
// GET /v1/sections/{section_id}/assignments
```

#### Generic iCal Connector
```typescript
// packages/connectors/src/connectors/ical-generic.ts
// For any platform that exports .ics feeds
// Use node-ical library to parse
// Validate URL is accessible before saving
// Handle HTTP auth (basic auth URL params)
// Deduplicate by VEVENT UID
// Respect LAST-MODIFIED for change detection
```

#### Generic Email Parser Connector
```typescript
// packages/connectors/src/connectors/email-generic.ts
// Handles emails forwarded to ingest@allstarfamhub.com
// Uses Claude claude-haiku-3 to extract structured event data
// Prompt template in section 5.3 below
// Works for any platform
```

---

## 5. Core Service Layer [BUILD]

### 5.1 Event Normalizer

```typescript
// packages/api/src/services/normalizer.ts
// Converts RawEventData → FamilyEvent
// Must handle:
// - Type classification: use keyword matching + Claude for ambiguous cases
// - Timezone normalization: always store in UTC, display in family timezone
// - Deduplication: match on (integrationId + externalId), update if changed
// - Change detection: diff all fields, write to EventChangeLog if changed
// - Priority assignment:
//   - URGENT: startAt < now + 4h, or deadline today
//   - HIGH: startAt < now + 24h, or deadline tomorrow
//   - NORMAL: everything else
//   - LOW: announcements with no date action

// Event type keyword classifier:
const EVENT_TYPE_KEYWORDS = {
  ASSIGNMENT: ['due', 'assignment', 'submit', 'homework', 'project', 'essay', 'lab report', 'quiz'],
  EXAM: ['exam', 'test', 'midterm', 'final', 'assessment'],
  NO_SCHOOL: ['no school', 'holiday', 'pd day', 'teacher workday', 'snow day', 'break', 'closed'],
  SPORTS: ['game', 'practice', 'match', 'tournament', 'meet', 'scrimmage', 'tryout'],
  MEETING: ['conference', 'meeting', 'iep', '504', 'counselor', 'orientation'],
  SCHOOL_EVENT: ['field trip', 'picture', 'concert', 'play', 'graduation', 'prom', 'homecoming'],
};
```

### 5.2 Alert Generator

```typescript
// packages/api/src/services/alert-generator.ts
// Runs after every sync cycle for a family
// Generates alerts for:
// 1. New events added (EventType determines alert priority)
// 2. Changed events (compare EventChangeLog — fire specific alert types)
// 3. Upcoming deadlines: run daily at 7am family timezone
//    - DEADLINE_TOMORROW: assignments due in 18-30 hours
//    - DEADLINE_TODAY: assignments due in 0-18 hours
// 4. Conflicts: after each sync, scan next 30 days for overlapping events
//    for same member — generate CONFLICT_DETECTED alert (deduplicated)
// 5. Signups needed: events with requiresSignup=true and no dismissal
// 6. Sync errors: integration hasn't synced successfully in >2x its interval

// Alert deduplication: before inserting, check for existing unread alert
// with same (familyId, eventId, type) created in last 24h — skip if exists

// After generating alerts, push notifications via NotificationService
```

### 5.3 Email Parser (Claude-powered)

```typescript
// packages/workers/src/parsers/email-parser.ts
// Called when email arrives at ingest address

const PARSE_PROMPT = `
You are parsing a school/sports notification email to extract calendar events.
Extract all events, deadlines, meetings, and schedule changes mentioned.

Return ONLY valid JSON matching this schema:
{
  "events": [
    {
      "title": "string — concise event name",
      "eventType": "ASSIGNMENT|EXAM|SCHOOL_EVENT|NO_SCHOOL|SPORTS|MEETING|ANNOUNCEMENT|PERSONAL",
      "startDate": "YYYY-MM-DD or null",
      "startTime": "HH:MM in 24h or null",
      "endDate": "YYYY-MM-DD or null", 
      "endTime": "HH:MM in 24h or null",
      "allDay": true|false,
      "location": "string or null",
      "description": "brief description or null",
      "isChange": true|false,
      "changeType": "CANCELLED|RESCHEDULED|LOCATION_CHANGED|null",
      "requiresAction": true|false,
      "actionDescription": "string or null",
      "confidence": 0.0-1.0
    }
  ],
  "senderPlatform": "string — detected platform name or null",
  "summary": "one sentence summary of the email"
}

Rules:
- If a date is relative (e.g. "this Friday"), resolve it against today's date: ${new Date().toISOString().split('T')[0]}
- If no date is mentioned, set startDate to null (it becomes an announcement)
- If an event is cancelled, set isChange=true and changeType=CANCELLED
- Only include events with confidence > 0.5
- Ignore marketing/promotional content

Email subject: {SUBJECT}
Email body:
{BODY}
`;

// Call claude-haiku-3 with this prompt
// Parse response JSON
// For each extracted event with startDate, create/update FamilyEvent
// For changeType events, find matching existing event and update it
```

### 5.4 Conflict Detector

```typescript
// packages/api/src/services/conflict-detector.ts
// After each sync, for each member, find overlapping events

// Algorithm:
// For each FamilyMember:
//   SELECT events WHERE startAt < (candidate.endAt) AND endAt > (candidate.startAt)
//   AND eventId IN member's events AND status = ACTIVE
// Group overlapping pairs
// For each new overlap not already alerted: generate CONFLICT_DETECTED alert
// Include both event titles and suggested action in alert body
```

### 5.5 Credential Encryption Service

```typescript
// packages/api/src/services/encryption.ts
// All stored credentials (username/password for scrapers) must be encrypted
// Algorithm: AES-256-GCM
// Key: derived from ENCRYPTION_MASTER_KEY env var via PBKDF2
// Never store credentials in plaintext
// Never log credentials
// Decrypt only in worker memory, immediately before use
```

---

## 6. Job Queue Architecture [BUILD]

Use BullMQ with Redis. Three queue types:

### 6.1 Queue Definitions

```typescript
// packages/workers/src/queues.ts

// SYNC_QUEUE: one job per integration per sync cycle
// Priority: ACTIVE integrations ordered by nextSyncAt ascending
// Concurrency: 10 workers for API integrations, 3 workers for scrapers
//   (scrapers are resource-heavy — each Playwright instance ~300MB RAM)

// PARSE_QUEUE: email parsing jobs
// Concurrency: 20 (API calls are cheap)
// Added when email webhook fires

// NOTIFY_QUEUE: push notification dispatch
// Concurrency: 50
// Added after alert generation

// SCHEDULER_QUEUE: cron-style recurring jobs
// - Every 1 minute: query integrations WHERE nextSyncAt <= now(), enqueue to SYNC_QUEUE
// - Daily at 6am UTC: deadline alert sweep for all families
// - Daily at 2am UTC: cleanup old RawItems (> 90 days)
// - Weekly: re-validate all stored credentials (scraper login check)
```

### 6.2 Sync Worker

```typescript
// packages/workers/src/sync-worker.ts
// Processes SYNC_QUEUE jobs

async function processSyncJob(job: Job<SyncJobData>) {
  const { integrationId } = job.data;
  
  // 1. Load integration with credentials (decrypt)
  // 2. Get connector by integration.connectorId
  // 3. Call connector.sync(config)
  // 4. For each returned RawEventData:
  //    a. Upsert to RawItem table (integrationId + externalId unique key)
  //    b. If new or changed: add to PARSE_QUEUE
  // 5. Call normalizer on new/changed items
  // 6. Call alert generator for this family
  // 7. Update integration.lastSyncAt, lastSyncStatus, nextSyncAt
  // 8. On error: increment error count, set lastSyncError, 
  //    exponential backoff on nextSyncAt, alert family if 3+ consecutive failures
}
```

### 6.3 Scraper Worker (Isolated)

```typescript
// packages/workers/src/scraper-worker.ts
// Playwright-based, runs in separate Docker container
// One container handles 3 concurrent browser sessions max
// Session cookies cached in Redis: key = scraper:{integrationId}:session
// TTL = 8 hours (typical school session length)
// On session expiry: re-authenticate, update cache
// User-agent rotation: rotate through 5 realistic browser user agents
// Respect robots.txt: check once per domain, cache result for 24h
// Rate limiting: minimum 2s between requests to same domain per integration
```

---

## 7. API Layer [BUILD]

Fastify server with full TypeScript. All routes require authentication except `/health` and `/webhooks/*`.

### 7.1 Route Structure

```
GET    /health                          — health check

POST   /auth/register                  — create account
POST   /auth/login                     — email/password login  
POST   /auth/logout
POST   /auth/refresh
GET    /auth/google                     — Google OAuth start
GET    /auth/google/callback

GET    /families/me                     — get own family
POST   /families                        — create family
PATCH  /families/:id                   — update family settings
GET    /families/:id/members           — list members
POST   /families/:id/members           — add member
PATCH  /families/:id/members/:memberId — update member
DELETE /families/:id/members/:memberId — remove member
POST   /families/:id/invite            — invite by email
POST   /families/join/:token           — accept invite

GET    /integrations                    — list family's integrations
POST   /integrations                    — add new integration
GET    /integrations/:id               — get integration status
PATCH  /integrations/:id               — update integration config
DELETE /integrations/:id               — remove integration
POST   /integrations/:id/sync          — force manual sync
GET    /integrations/:id/logs          — recent sync log
GET    /integrations/:id/auth-url      — get OAuth URL (OAuth integrations)
POST   /integrations/:id/auth-callback — handle OAuth code exchange
GET    /integrations/ingest-email      — get family's email ingest address

GET    /connectors                      — list available connector plugins

GET    /events                          — list events (filters: member, start, end, type)
POST   /events                          — create manual event
GET    /events/:id                      — get single event with members
PATCH  /events/:id                      — update manual event
DELETE /events/:id                      — delete manual event
GET    /events/today                    — today's events for whole family
GET    /events/conflicts               — upcoming conflicts

GET    /alerts                          — list alerts (filter: unread, memberId)
PATCH  /alerts/:id/read                — mark read
PATCH  /alerts/read-all               — mark all read
DELETE /alerts/:id                     — dismiss

GET    /members/:id/events             — events for specific member
GET    /members/:id/feed               — chronological feed (events + alerts)

POST   /webhooks/email-ingest          — SendGrid inbound parse webhook
POST   /webhooks/stripe                — Stripe billing webhook

GET    /admin/stats                     — platform stats (admin only)
GET    /admin/integrations/errors      — failing integrations (admin only)
```

### 7.4 Manual Event Creation [BUILD]

Parents can add personal family events directly — no integration required. This is a core feature, not an afterthought.

```typescript
// Manual events are first-class FamilyEvents with sourceIntegrationId = null
// Full CRUD via existing /events routes

// POST /events — create manual event
// Required: title, startAt, eventType
// Optional: endAt, allDay, location, description, memberIds[], priority, deadlineAt
// Validation: startAt must be valid date, endAt must be after startAt if provided

// Manual event UI requirements:
// Quick-add (tap any calendar day → modal):
//   - Title field (large, autofocus)
//   - Date/time picker (pre-filled with tapped date)
//   - Member selector (chip toggles for each family member)
//   - "More options" expander for: location, notes, recurrence, priority
//   - Save button → event appears immediately on calendar

// Full event form (/events/new):
//   - All fields including recurrence (daily/weekly/monthly/yearly with end date)
//   - Rich text description
//   - Location with map preview
//   - Assign to one or multiple members
//   - Set reminder (push notification X hours before)
//   - Event type selector with icons

// Manual events show differently on calendar:
//   - Source badge: "Family" in green (not a platform name)
//   - Edit/delete always available (unlike agent-sourced events which are read-only)
//   - Agent-sourced events: show "Managed by [Agent Name]" — editing disabled
//     (editing managed events would be overwritten on next sync — explain this clearly)

// Personal reminders on manual events:
model EventReminder {
  id        String      @id @default(cuid())
  eventId   String
  userId    String      // who gets the reminder
  minutesBefore Int     // 0=at time, 60=1hr before, 1440=day before, etc.
  sent      Boolean     @default(false)
  sentAt    DateTime?
  event     FamilyEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())

  @@index([eventId])
  @@index([sent, sentAt])
}
// Reminder worker: every minute, query EventReminders WHERE sent=false
//   AND events.startAt <= now() + minutesBefore minutes
//   Send push notification, mark sent=true
```



```typescript
// All authenticated routes: verify Supabase JWT
// Extract familyId from FamilyMember record linked to user
// Attach { userId, familyId, role } to request context
// Route-level guards: ADMIN role required for family management mutations
// Family isolation: all DB queries MUST include familyId = context.familyId
```

### 7.3 Real-time Updates

```typescript
// Use Fastify WebSocket plugin
// Family members subscribe to ws://api/events/stream?familyId={id}
// Server pushes events when:
//   - New alert generated for family
//   - Integration sync completes
//   - New event added or event changed
// Payload: { type: 'ALERT'|'EVENT_UPDATE'|'SYNC_COMPLETE', data: {...} }
// Mobile app uses polling (every 30s) as WebSocket fallback
```

---

## 8. Web Application [BUILD]

Next.js 14 App Router. Full TypeScript. Deploy to Vercel.

### 8.1 Page Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── invite/[token]/page.tsx
├── (app)/
│   ├── layout.tsx            — sidebar + topbar shell
│   ├── today/page.tsx        — TODAY tab (default landing)
│   ├── calendar/page.tsx     — FullCalendar month/week/agenda view
│   ├── alerts/page.tsx       — alert inbox with filters
│   ├── members/
│   │   ├── page.tsx          — family member management
│   │   └── [id]/page.tsx     — per-member event view
│   ├── integrations/
│   │   ├── page.tsx          — integration status dashboard
│   │   ├── add/page.tsx      — add integration wizard
│   │   └── [id]/page.tsx     — integration detail + logs
│   └── settings/page.tsx     — family settings, notifications, billing
└── api/                      — Next.js API routes (thin proxy to Fastify)
```

### 8.2 Key Components [BUILD]

#### FamilyCalendar (FullCalendar wrapper)
```typescript
// apps/web/src/components/FamilyCalendar.tsx
// Props: events[], members[], onEventClick, onDateClick
// Features:
// - Member color coding (each member has a color from FamilyMember.color)
// - Source badges on events (colored pill showing Canvas/SportsYou/etc)
// - Click event → EventDetailDrawer
// - Hover → tooltip with full event info
// - Views: month, week, day, listWeek (agenda)
// - Member filter chips above calendar (toggle individual members)
// - Event type filter (Academics | Sports | School | All)
// - Today button
// - Print-friendly CSS
```

#### TodayView
```typescript
// apps/web/src/components/TodayView.tsx
// Prime real estate — what most users see daily
// Top section: urgent alerts (amber banner, dismissible)
// Middle: chronological event cards for today + tomorrow
//   Each card: member avatar, source badge, title, time, location
//   Deadline cards show: assignment name, class, due time, weight
// Bottom: "Coming up this week" — next 5 events
// Empty state: "All clear — nothing scheduled today 🎉"
```

#### AlertInbox
```typescript
// apps/web/src/components/AlertInbox.tsx
// Left sidebar: filter by member, filter by alert type
// Alert list: sorted newest first
// Unread alerts have left border accent
// Click alert → expand detail, mark as read
// Batch actions: "Mark all read", "Dismiss all older than 7 days"
// Alert cards show: source badge, member avatar, time ago, action button if applicable
```

#### IntegrationWizard
```typescript
// apps/web/src/components/IntegrationWizard.tsx
// Step 1: Pick connector from grid (logos, search, categories)
// Step 2: Select family member (or "whole family")
// Step 3: Choose method (show only available methods for this connector)
// Step 4: Enter credentials / follow OAuth / set up email forwarding
//   - For OAuth: open popup window, handle callback
//   - For scraper: username + password fields (explain encryption)
//   - For iCal: URL field + instructions with screenshots
//   - For email: show assigned ingest address + forwarding instructions
// Step 5: Test connection ("Running first sync...")
// Step 6: Success — show events found
```

#### EventDetailDrawer
```typescript
// apps/web/src/components/EventDetailDrawer.tsx
// Right-side drawer, opens on event click
// Shows: title, type badge, source badge, date/time, location (with map link)
// For assignments: due date, grade weight, class name, link to original
// Members attending
// Change history (if event was modified): diff view
// Actions: Add to personal calendar (export ICS), Dismiss, Share
```

### 8.3 Design System

```typescript
// Use shadcn/ui as component base
// Custom theme:
const theme = {
  primary: '#1D9E75',    // teal — brand color
  secondary: '#E1F5EE',
  accent: '#EF9F27',     // amber — for alerts
  danger: '#D85A30',     // coral — for urgent/cancelled
  
  // Member color defaults (user can override):
  memberColors: ['#1D9E75', '#378ADD', '#D85A30', '#EF9F27', '#534AB7', '#E24B4A'],
  
  // Source badge colors:
  sourceBadges: {
    canvas:           { bg: '#E6F1FB', text: '#185FA5' },
    'infinite-campus': { bg: '#FAECE7', text: '#993C1D' },
    parentsquare:     { bg: '#EEEDFE', text: '#534AB7' },
    sportsyou:        { bg: '#FAEEDA', text: '#854F0B' },
    'google-classroom': { bg: '#EAF3DE', text: '#3B6D11' },
  }
}
```

---

## 9. Mobile Application [BUILD]

React Native + Expo. Target iOS 16+ and Android 12+. Use Expo Router.

### 9.1 Screen Structure

```
app/
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   └── invite.tsx
├── (tabs)/
│   ├── _layout.tsx        — bottom tab navigator
│   ├── today.tsx          — Today tab (default)
│   ├── calendar.tsx       — Calendar tab
│   ├── alerts.tsx         — Alerts tab (badge count)
│   └── sources.tsx        — Integrations tab
└── modals/
    ├── event-detail.tsx
    ├── add-integration.tsx
    └── member-filter.tsx
```

### 9.2 Mobile-Specific Features [BUILD]

#### Push Notifications
```typescript
// On app open: request notification permission
// Register FCM/APNs token → POST /users/push-token
// Notification tap → deep link to relevant screen
// Notification types:
//   - Alert: → open alerts screen
//   - Event changed: → open event detail
//   - Deadline today: → open today screen
// Notification groups: group by family member in iOS notification center

// Local notifications for daily digest:
// 7:00am: "Today for [Family Name]: X events"
// (Only if no push received that morning)
```

#### Today Screen (Mobile)
```typescript
// Swipeable header: swipe left/right to change date
// Current date shown prominently
// Urgency section: amber cards for alerts needing action
// Event list: grouped by time, member color strip on left
// FAB: "+" to add manual event
// Pull-to-refresh: triggers manual sync for all integrations
// Long press event: quick actions (dismiss, add reminder, share)
```

#### Calendar Screen (Mobile)
```typescript
// Week strip at top (like iOS Calendar)
// Member filter pills below strip
// Below: agenda list for selected day
// Tap day in strip: show that day's events
// Month picker: tap month name → full month picker
```

#### Offline Mode
```typescript
// Cache last 30 days of events in SQLite via expo-sqlite
// Cache unread alerts
// Show "Last synced X minutes ago" when offline
// Queue any manual event additions for sync when online
```

#### Biometric Auth
```typescript
// Option to unlock app with FaceID/TouchID after first login
// Store JWT refresh token in SecureStore
// Auto-lock after 5 minutes background
```

---

## 10. Email Ingest System [BUILD]

Every family gets a unique ingest address: `{familyId}@ingest.allstarfamhub.com`

### 10.1 SendGrid Inbound Parse Setup
```
// Configure MX record: ingest.allstarfamhub.com → mx.sendgrid.net
// SendGrid Inbound Parse webhook → POST /webhooks/email-ingest
// Webhook validates SendGrid signature before processing
```

### 10.2 Email Processing Pipeline
```typescript
// 1. Receive email via webhook
// 2. Look up family by recipient address (ingest.allstarfamhub.com portion)
// 3. Identify source platform from sender domain:
//    - mail.sportsyou.com → sportsyou
//    - notification@parentsquare.com → parentsquare
//    - no-reply@remind.com → remind
//    - canvas@{any}.edu → canvas
//    - else → generic
// 4. Route to platform-specific parser if available, else generic parser
// 5. Generic parser: send to Claude with PARSE_PROMPT (section 5.3)
// 6. Store extracted events as RawItems with integrationId of email integration
// 7. Normalizer converts to FamilyEvents
// 8. Alert generator runs
// 9. Archive email (store S3 or Supabase storage) for 30 days
```

---

## 11. Security & Privacy Standards [BUILD]

This section is NON-NEGOTIABLE. All Star Fam Hub handles children's personal information, school records, and family credentials. Every line of code must treat security as a first-class requirement, not an afterthought. COPPA, FERPA, and CCPA compliance are mandatory.

### 11.1 Regulatory Compliance

```typescript
// COPPA (Children's Online Privacy Protection Act)
// - Children under 13: no direct accounts. Parents create family account,
//   add children as members. Child members have NO login, NO email collected.
// - Never collect more data from or about children than operationally necessary
// - Parental consent is implicit in family account creation (parent is account owner)
// - Data deletion: when family deletes account, ALL child data deleted within 30 days
// - No behavioral advertising, ever. No data sold to third parties, ever.
// - Privacy policy must be written in plain English, not legalese

// FERPA (Family Educational Rights and Privacy Act)
// - Education records (grades, assignments) treated as highest sensitivity tier
// - Never share education record data with any third party
// - Audit log every access to grade/assignment data
// - District integrations: districts must have FERPA-compliant data sharing agreement
//   in place before All Star Fam Hub can access their student data systems

// CCPA (California Consumer Privacy Act) — apply to all users regardless of state
// - Clear privacy policy: what data collected, why, how long retained
// - Right to deletion: honor within 30 days, purge from all systems including backups
// - Right to export: one-click data export (JSON) of all family events, alerts, settings
// - No sale of personal data — enforce via contractual prohibition with all vendors
// - "Do Not Sell" toggle in settings (even though we don't sell — makes compliance clear)
```

### 11.2 Data Classification & Handling

```typescript
// TIER 1 — CRITICAL (children's PII, credentials)
// Examples: child name+age+school, login credentials for school systems
// Controls:
//   - AES-256-GCM encryption at rest, always
//   - Never logged, never in error messages, never in analytics
//   - Only decrypted in isolated worker memory, zeroed after use
//   - Access requires explicit audit log entry
//   - Retention: deleted immediately on integration removal

// TIER 2 — SENSITIVE (education records, grades, schedules)
// Examples: assignment grades, attendance, IEP references
// Controls:
//   - Encrypted at rest in database (Supabase column-level encryption)
//   - Never sent to third-party analytics
//   - Never used for any purpose other than displaying to the family
//   - Retention: configurable by family, max 2 years, deleted on account closure

// TIER 3 — INTERNAL (event metadata, sync logs, usage stats)
// Examples: sync timestamps, error counts, connector type
// Controls:
//   - Standard database security
//   - May be used for internal analytics (aggregate, never individual)
//   - Retention: 90 days for logs, 1 year for aggregate stats

// TIER 4 — PUBLIC (connector definitions, app config)
// No PII, freely accessible
```

### 11.3 Credential Security Architecture

```typescript
// packages/api/src/services/vault.ts

// MASTER KEY ROTATION:
// - ENCRYPTION_MASTER_KEY is a 32-byte key stored ONLY in Railway/Vercel env vars
// - Key rotation procedure: generate new key, re-encrypt all credentials, update env var
// - Never store master key in DB, code, logs, or version control

// PER-CREDENTIAL ENCRYPTION:
// Each stored credential gets its own random 12-byte IV (nonce)
// Cipher: AES-256-GCM (provides both encryption and authentication)
// Schema stored in DB: { iv: base64, tag: base64, ciphertext: base64 }
// Key derivation: PBKDF2(masterKey + familyId, salt=integrationId, iterations=100000, sha256)
//   Using familyId in KDF means even if DB is dumped, you need both master key AND
//   the family record to decrypt — defense in depth

// CREDENTIAL LIFECYCLE:
// 1. Family enters credentials in UI
// 2. Transmitted over TLS 1.3 only
// 3. API receives, immediately encrypts, stores encrypted blob — plaintext never touches disk
// 4. Worker needs credentials: API decrypts in memory, passes to worker via encrypted channel
// 5. Worker uses credentials, zeroes memory after use (Buffer.fill(0))
// 6. Credentials NEVER appear in:
//    - Application logs
//    - Error messages (show "authentication error" not "wrong password for user@school.edu")
//    - Analytics events
//    - Crash reports (filter before sending to any APM)
//    - Database query logs

// SCRAPER SESSION ISOLATION:
// - Each scraper worker runs in its own Docker container with no shared filesystem
// - Session cookies stored in Redis with TTL, encrypted with family-specific key
// - Workers cannot access other families' sessions — enforced by key namespacing
// - Redis keys: vault:{familyId}:{integrationId}:session (never just integrationId)

// RE-AUTH DETECTION:
// If scraper detects it's on a login page unexpectedly:
//   1. Clear cached session from Redis
//   2. Attempt re-login with stored credentials
//   3. If re-login fails: mark integration EXPIRED, generate SYNC_ERROR alert
//   4. NEVER store new credentials from a scraped login page (anti-phishing)
```

### 11.4 Network Security

```typescript
// TLS: TLS 1.3 minimum everywhere. Reject TLS 1.2 and below.
// HSTS: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
// Certificate pinning: mobile app pins to *.allstarfamhub.com cert chain

// API Security Headers (all responses):
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'nonce-{nonce}'",  // nonce-based CSP, no unsafe-inline
    "style-src 'self' 'nonce-{nonce}'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.allstarfamhub.com wss://api.allstarfamhub.com",
    "frame-ancestors 'none'",
  ].join('; '),
};

// CORS: strict whitelist
const CORS_ORIGINS = [
  'https://allstarfamhub.com',
  'https://www.allstarfamhub.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

// Rate limiting (Redis-backed, per IP AND per family):
const RATE_LIMITS = {
  auth_login:     { window: '1m', max: 5,    blockDuration: '15m' },
  auth_register:  { window: '1h', max: 3,    blockDuration: '24h' },
  api_general:    { window: '1m', max: 100,  blockDuration: '5m'  },
  api_sync_force: { window: '1h', max: 10,   blockDuration: '1h'  },
  webhook_ingest: { window: '1m', max: 1000, blockDuration: '1m'  },
};
// On rate limit: return 429 with Retry-After header, log the event
// Persistent rate limit abuse: auto-block IP, alert admin
```

### 11.5 Authentication & Authorization

```typescript
// Authentication: Supabase Auth with RS256 JWT
// JWT expiry: 1 hour access token, 30-day refresh token
// Refresh token rotation: new refresh token issued on each use (old one invalidated)
// Session revocation: maintain revocation list in Redis for logout

// Multi-Factor Authentication:
// - TOTP (Google Authenticator compatible) available for all accounts
// - Required for: admin accounts, district accounts
// - Recommended for: any parent account (shown prominently in onboarding)

// Authorization — Row Level Security:
// ALL database queries MUST pass familyId from JWT context
// Prisma middleware enforces this — any query without familyId throws, not returns empty
// No query ever touches another family's data — enforced at ORM layer, not just API layer

// Admin access:
// - Separate admin role in DB, not derivable from normal user flow
// - Admin UI on separate subdomain: admin.allstarfamhub.com
// - Requires MFA, IP allowlist (office/VPN IPs only)
// - All admin actions write to immutable audit log (append-only table, no deletes)
// - "Support access" to family data: requires explicit admin action, logged, time-limited (1h)

// Family member permissions matrix:
// ADMIN (parent):  read/write all family data, manage integrations, manage billing
// PARENT:          read/write all family data, manage integrations, no billing
// CHILD:           read own events only, no integrations, no settings
```

### 11.6 Data Minimization & Retention

```typescript
// Collect ONLY what is needed to provide the service:
// - Parent: email, display name, timezone, push tokens
// - Child member: display name, grade, school name (NO email, NO phone, NO DOB unless needed)
// - Events: title, date, location, source — NO grades stored unless explicitly grade-tracking feature
// - Credentials: encrypted and deleted immediately when integration removed

// Retention schedules (enforced by automated cleanup jobs):
// - Events: per plan (FREE=30d, PAID=2yr), deleted 30d after account closure
// - Alerts: 90 days, then archived (not deleted — may be needed for support)
// - Raw scraped data (RawItems): 7 days (parsed and normalized, raw not needed longer)
// - Sync logs: 30 days
// - LLM usage logs: 90 days
// - Audit logs: 7 years (legal requirement for some FERPA situations)
// - Stripe records: per Stripe's retention (7 years) — we keep only transaction IDs

// Data export (right to portability):
// Family can request full data export from Settings
// Export generated as JSON zip: events, alerts, member info (no credentials — those are write-only)
// Export ready within 24 hours, download link emailed, link expires in 48 hours
// Export includes human-readable README explaining the data structure

// Account deletion:
// Immediate: revoke all sessions, disable login
// Within 24h: delete credentials, push tokens, active sessions
// Within 30 days: delete all events, alerts, members, integrations
// Stripe: cancel subscription, retain transaction records per legal requirement
// Backups: purged from backup rotation within 90 days
// Send confirmation email when deletion complete
```

### 11.7 Scraper Ethics & Legal Posture

```typescript
// Terms of Service compliance:
// - Review ToS for each scraped platform before building connector
// - If platform ToS explicitly prohibits automated access: use email/iCal only
// - Document ToS review date and finding in connector file header
// - Re-review annually or when ToS changes detected

// Rate limiting and server courtesy:
// - Minimum 2 seconds between requests to same domain
// - Scraper identifies itself with honest User-Agent: 
//   "AllStarFamHub/1.0 (family calendar aggregator; contact@allstarfamhub.com)"
// - Respect robots.txt (check once per domain per 24h, cache result)
// - Never scrape during site maintenance windows (detect and back off)
// - Exponential backoff on errors: 1m → 5m → 15m → 1h → 6h → 24h
// - If site returns 429: honor Retry-After header completely

// Data usage:
// - Scraped data used ONLY to display events to the family whose credentials were used
// - NEVER aggregate scraped data across families for any purpose
// - NEVER use scraped data to train models
// - NEVER sell, share, or expose scraped data to third parties
```

### 11.8 Incident Response

```typescript
// Security incident severity levels:
// SEV-1 (CRITICAL): credential breach, unauthorized data access, ransomware
//   Response: immediate (within 15 minutes, 24/7)
//   Actions: take service offline if needed, notify affected families within 72h (GDPR/CCPA),
//            notify authorities if children's data involved (COPPA requirement)

// SEV-2 (HIGH): encryption key exposure, auth bypass, mass PII exposure
//   Response: within 1 hour
//   Actions: patch and redeploy, audit affected scope, notify if PII exposed

// SEV-3 (MEDIUM): single-family data exposure, scraper credential leak
//   Response: within 4 hours business hours
//   Actions: revoke affected credentials, notify affected family, patch

// Breach notification:
// - Affected families: within 72 hours of discovery (email + in-app banner)
// - Regulators: per applicable law (CCPA = 72h for California residents)
// - For children's data: notify FTC if COPPA breach (federal requirement)

// Bug bounty: launch with HackerOne private program for security researchers
//   Scope: allstarfamhub.com, api.allstarfamhub.com, mobile apps
//   Rewards: $50-$5000 depending on severity
//   Contact: security@allstarfamhub.com published in /.well-known/security.txt
```

### 11.9 Third-Party Vendor Security

```typescript
// Only use vendors with SOC 2 Type II certification (or equivalent):
// - Supabase: SOC 2 Type II ✓
// - Railway: SOC 2 Type II ✓
// - Vercel: SOC 2 Type II ✓
// - SendGrid: SOC 2 Type II ✓
// - Stripe: PCI-DSS Level 1 + SOC 2 ✓
// - Firebase (FCM): Google Cloud SOC 2 ✓
// - Anthropic API: review DPA before using for any child data parsing

// Anthropic API data handling:
// - Email content sent to Claude for parsing may contain child PII
// - Sign Anthropic's Data Processing Addendum before production launch
// - Use zero-retention API option if available (data not used for training)
// - Scrub obvious PII from email before sending to Claude where possible
//   (replace student name with "[STUDENT]", school name with "[SCHOOL]" in prompt)
// - Log what categories of data were sent (not the data itself) for audit purposes

// Vendor review: annual security review of all vendors
// DPA (Data Processing Agreement) required with every vendor that touches user data
```

---

## 12. Environment Variables [CONFIG]

```bash
# packages/api/.env

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  # Supabase direct connection for migrations

# Auth
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...   # server-side only, never expose to client
SUPABASE_JWT_SECRET=...

# Security & Vault
ENCRYPTION_MASTER_KEY=   # 32-byte hex: openssl rand -hex 32 — NEVER commit, rotate quarterly
CREDENTIAL_HMAC_SECRET=  # separate secret for HMAC signing of audit log entries
ADMIN_IP_ALLOWLIST=      # comma-separated CIDR blocks for admin panel access
SECURITY_ALERT_EMAIL=    # security@allstarfamhub.com — receives breach/anomaly alerts

# LLM Usage
ANTHROPIC_API_KEY=
LLM_FREE_DAILY_CAP=0
LLM_AGENT_DAILY_CAP=50
LLM_FAMILY_DAILY_CAP=200
LLM_DISTRICT_DAILY_CAP=500
LLM_COST_ALERT_THRESHOLD_PCT=8  # alert if LLM cost exceeds 8% of MRR

REDIS_URL=redis://...

# Email
SENDGRID_API_KEY=...
SENDGRID_INBOUND_PARSE_API_KEY=...  # for webhook signature validation
INGEST_EMAIL_DOMAIN=ingest.allstarfamhub.com

# AI
ANTHROPIC_API_KEY=...

# OAuth (for connectors)
CANVAS_CLIENT_ID=...
CANVAS_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SCHOOLOGY_CONSUMER_KEY=...
SCHOOLOGY_CONSUMER_SECRET=...

# Firebase (push notifications)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Stripe (billing)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# App
API_URL=https://api.allstarfamhub.com
WEB_URL=https://allstarfamhub.com
NODE_ENV=production
LOG_LEVEL=info

# apps/web/.env
NEXT_PUBLIC_API_URL=https://api.allstarfamhub.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_WS_URL=wss://api.allstarfamhub.com
```

---

## 13. Docker Configuration [CONFIG]

```dockerfile
# docker/scraper-worker.Dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY packages/workers ./packages/workers
COPY packages/connectors ./packages/connectors
COPY packages/shared ./packages/shared

RUN pnpm build

# Install Playwright browsers
RUN npx playwright install chromium

ENV NODE_ENV=production
CMD ["node", "packages/workers/dist/scraper-worker.js"]
```

```yaml
# docker-compose.yml (for local development)
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: allstarfamhub
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: localdev
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: .
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://postgres:localdev@postgres:5432/allstarfamhub
      REDIS_URL: redis://redis:6379
    volumes: [.:/app]

  worker-api:
    build: .
    command: node packages/workers/dist/sync-worker.js
    depends_on: [postgres, redis]

  worker-scraper:
    build:
      context: .
      dockerfile: docker/scraper-worker.Dockerfile
    depends_on: [redis]
    deploy:
      replicas: 2

volumes:
  postgres_data:
```

---

## 14. Railway Deployment Configuration [CONFIG]

```toml
# railway.toml
[build]
  builder = "nixpacks"

[[services]]
  name = "api"
  startCommand = "node packages/api/dist/server.js"
  healthcheckPath = "/health"
  healthcheckTimeout = 10

[[services]]
  name = "worker-sync"
  startCommand = "node packages/workers/dist/sync-worker.js"

[[services]]
  name = "worker-scraper"
  startCommand = "node packages/workers/dist/scraper-worker.js"
  # Scale to 3 replicas
  
[[services]]
  name = "worker-notify"
  startCommand = "node packages/workers/dist/notify-worker.js"
```

---

## 15. Onboarding Flow [BUILD]

This is where user adoption is won or lost. Make it frictionless.

### 15.1 Registration → First Event in <3 Minutes

```
Step 1: Sign Up
  - Email + password OR "Sign in with Google" (preferred)
  - Family name
  - Timezone (auto-detect from browser)

Step 2: Add Family Members (can skip, add later)
  - "Who's in your family?" 
  - Add cards: Name, Role (Parent/Child), Grade, School
  - Pre-built: "Add Parent" and "Add Child" buttons

Step 3: Connect Your First App (can't skip — this is the value)
  - Big friendly grid of connector logos
  - "What apps does your school or team use?"
  - Each card: logo + "Connect" button
  - Most common shown first: Canvas, Google Classroom, ParentSquare, Infinite Campus, SportsYou
  - "Don't see yours? Add by email forwarding"
  - User picks one, completes auth for that connector
  - Show live sync progress: "Finding events... Found 23 events!"

Step 4: Success
  - Show calendar with events populated
  - Prompt: "Add another app?" or "I'm done for now"
  - Offer to install mobile app (QR code on desktop)

Step 5: Mobile Install Prompt (web)
  - "Get alerts instantly on your phone"
  - iOS: link to App Store
  - Android: link to Play Store
  - PWA fallback: "Add to Home Screen" instruction
```

---

## 16. Notification Preferences [BUILD]

```typescript
// Per-family, per-member notification settings
model NotificationPreferences {
  id          String  @id @default(cuid())
  familyId    String
  memberId    String? // null = family-wide default
  
  // Channels
  pushEnabled   Boolean @default(true)
  emailEnabled  Boolean @default(true)
  smsEnabled    Boolean @default(false)
  
  // Alert types to notify on
  notifyEventAdded      Boolean @default(true)
  notifyEventChanged    Boolean @default(true)
  notifyLocationChanged Boolean @default(true)  // always true recommended
  notifyDeadlineToday   Boolean @default(true)
  notifyDeadlineTomorrow Boolean @default(true)
  notifyGradePosted     Boolean @default(false)
  notifyConflict        Boolean @default(true)
  
  // Quiet hours (in family timezone)
  quietHoursEnabled Boolean @default(true)
  quietHoursStart   String  @default("21:00")
  quietHoursEnd     String  @default("07:00")
  
  // Daily digest (instead of individual alerts)
  dailyDigestEnabled Boolean @default(false)
  dailyDigestTime    String  @default("07:00")
}
```

---

## 17. Billing (Stripe) [BUILD]

### Pricing Tiers

```
FREE
  - 1 agent (family's choice of connector)
  - Unlimited family members
  - 30-day event history
  - LLM parsing: disabled (API-based connectors only on free tier)
  - Sync interval: every 30 minutes
  - No credit card required, never expires

PER-AGENT ($1.99/month per agent)
  - Pay only for what you use
  - Each additional agent beyond the free one: $1.99/month
  - LLM parsing enabled (email + SMS parsing, capped at 50 calls/day per family)
  - Sync interval: every 15 minutes
  - 1-year event history

FAMILY UNLIMITED ($14.99/month or $119.99/year)
  - Unlimited agents
  - Unlimited members
  - LLM parsing fully enabled (capped at 200 calls/day — circuit breaker above this)
  - Sync interval: every 5 minutes for API-based, every 10 minutes for scraper-based
  - 2-year event history
  - Priority support
  - Conflict detection and smart scheduling insights
  - Export to Google Calendar / Apple Calendar / Outlook

DISTRICT LICENSE ($3.00/student/year — B2B, contact sales)
  - All families in district get FAMILY UNLIMITED free
  - District admin dashboard
  - Bulk connector configuration (district sets up IC, Canvas, etc. once for all families)
  - SLA: 99.9% uptime, dedicated support channel
  - SSO via district identity provider (Clever, ClassLink)
  - Billed annually to district
```

### LLM Cost Controls [BUILD]

```typescript
// Claude API is used ONLY for email/SMS parsing — never for API-based connectors
// Cost estimate: ~$0.00072 per parse call (Haiku, 800 in + 200 out tokens)
// Realistic family usage: 10-20 parse calls/day = ~$0.40-0.80/month
// Worst case: 100 calls/day = ~$2.16/month (still manageable at scale)

// Enforcement:
model LlmUsage {
  id          String   @id @default(cuid())
  familyId    String
  date        String   // YYYY-MM-DD
  callCount   Int      @default(0)
  tokenCount  Int      @default(0)
  costUsdMil  Int      @default(0) // cost in milli-cents for precision
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([familyId, date])
  @@index([familyId])
}

// Daily caps by plan:
const LLM_DAILY_CAPS = {
  FREE: 0,          // no LLM on free tier
  PER_AGENT: 50,    // ~$1.08/month worst case
  FAMILY: 200,      // ~$4.32/month worst case
  DISTRICT: 500,    // per family — district absorbs cost
};

// Circuit breaker: if family hits 80% of daily cap, log warning
// At 100% cap: switch to rule-based parsing for remainder of day
// Never hard-fail silently — log the event, continue with rule-based fallback
// Alert family admin if they hit cap 3 days in a row (likely misconfigured email loop)

// Cost tracking: after every Claude call, increment LlmUsage for that family+date
// Monthly cost report in admin dashboard
// If Claude costs exceed 8% of MRR in a month: alert engineering
```

### Stripe Implementation [BUILD]

```typescript
// Stripe Products:
// prod_agent_monthly: $1.99/month (metered by agent count)
// prod_family_monthly: $14.99/month
// prod_family_annual: $119.99/year

// Agent billing model:
// Use Stripe metered billing or quantity-based subscription items
// When family adds 3rd agent: automatically add quantity to their subscription
// When family removes agent: reduce quantity at end of billing period (not immediately)
// Show clear "Adding this agent will add $1.99 to your monthly bill" before confirm

// Implementation:
// - Stripe Checkout for initial upgrade flow
// - Stripe Customer Portal for manage/cancel/change plan
// - Webhook handlers: subscription.created, subscription.updated,
//   subscription.deleted, invoice.payment_failed, invoice.payment_succeeded
// - On payment_failed: 7-day grace period with daily email reminders
//   After 7 days: pause agents (don't delete data), downgrade UI to FREE
//   Data retained for 30 days post-downgrade before cleanup
// - Free tier: no card required, no expiry, no nagware (one tasteful upgrade prompt/week max)

// District billing:
// - Manual invoice via Stripe (not self-serve)
// - Annual contract, NET-30 payment terms
// - District gets org-level account with child family accounts underneath
```

---

## 18. Admin Dashboard [BUILD]

```typescript
// Simple internal-only admin panel at /admin (IP-restricted or separate subdomain)
// Built with Next.js server components

// Metrics to show:
// - Total families, MAU, new signups (daily/weekly/monthly chart)
// - Integration health: % of integrations syncing successfully
// - Top connectors by usage
// - Failing integrations (list with error details)
// - Email parse queue depth
// - Scraper worker health
// - Claude API usage + cost this month

// Actions:
// - Force sync any integration
// - View any family's events (for support, with audit log)
// - Disable a connector globally
// - Broadcast system announcement to all families
```

---

## 19. Testing Requirements [BUILD]

```typescript
// Unit tests: Vitest
// - Normalizer: test event type classification with 50 example titles
// - Email parser: test with real email samples (fixtures in tests/fixtures/emails/)
// - Conflict detector: test overlapping event detection
// - Encryption: test encrypt/decrypt roundtrip

// Integration tests: Vitest + testcontainers
// - API routes: test with real Postgres + Redis containers
// - Queue jobs: test sync job end-to-end with mock connector

// E2E tests: Playwright (web)
// - Registration → add integration → see events on calendar
// - Receive alert → mark read
// - Invite family member

// Connector tests: use recorded HTTP fixtures (nock/msw)
// - Each connector has a test with 5 sample API responses

// Load testing: k6
// - 100 concurrent API users, target <200ms p95
// - 1000 concurrent sync jobs in queue
```

---

## 20. Seed Data [BUILD]

```typescript
// scripts/seed.ts
// Creates a complete demo family for development:

// Family: "The Wilson Family"
// Members: Ken (Admin), Sarah (Parent), Emma (16, 10th grade), Jake (12, 7th grade)
// Integrations (all with mock data, no real credentials):
//   - Emma: Canvas (20 upcoming assignments, 3 exams)
//   - Emma: SportsYou (track team - 8 meets, weekly practices)
//   - Jake: Canvas (15 upcoming assignments)
//   - Jake: SportsYou (soccer - 12 games, 3x/week practices)
//   - Family: ParentSquare (school announcements, no-school days)
//   - Family: Infinite Campus (grade reports for both kids)
// Alerts: 4 unread (location change, deadline today, parent conf signup, grade posted)
// Generate 3 conflicts (Emma's track meet overlaps Jake's soccer game)

// Run: pnpm seed
```

---

## 21. README for Claude Code [CONFIG]

```markdown
# All Star Fam Hub — Dev Setup

## Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop
- PostgreSQL 15 (or use Docker)
- Redis (or use Docker)

## First-time setup
pnpm install
docker-compose up -d postgres redis
cp .env.example .env  # fill in your keys
pnpm prisma migrate dev
pnpm seed
pnpm dev  # starts all services concurrently

## Development servers
- API: http://localhost:3001
- Web: http://localhost:3000
- Prisma Studio: npx prisma studio (port 5555)
- BullMQ Dashboard: http://localhost:3001/admin/queues

## Key commands
pnpm build          — build all packages
pnpm test           — run all tests
pnpm lint           — ESLint + TypeScript check
pnpm prisma migrate dev  — run pending migrations
pnpm seed           — populate dev database
pnpm dev:workers    — start job queue workers

## Adding a new connector
1. Create packages/connectors/src/connectors/{name}.ts
2. Implement the Connector interface
3. Register in packages/connectors/src/registry.ts
4. Add ConnectorDefinition seed to prisma/seed.ts
5. Add tests in packages/connectors/src/__tests__/{name}.test.ts
6. Add logo to apps/web/public/connectors/{name}.png
```

---

## 22. Build Order for Claude Code

Execute in this sequence to avoid dependency issues:

1. **Initialize monorepo** — pnpm workspace, TypeScript config, ESLint, base tsconfig
2. **Shared package** — types, schemas (Zod), utility functions
3. **Prisma schema + initial migration** — run `prisma migrate dev`
4. **Connector package** — interface types, registry, then each connector (Canvas first as simplest OAuth)
5. **API package** — Fastify server, auth middleware, all routes (stubs ok, flesh out incrementally)
6. **Workers package** — queues, sync worker, email parser, notification worker
7. **Web app** — Next.js setup, auth pages, then main app pages
8. **Mobile app** — Expo setup, auth screens, main tab screens
9. **Docker + deployment config** — Dockerfiles, railway.toml, vercel.json
10. **Seed script** — so the whole thing can be demoed immediately
11. **Tests** — unit tests for core services, at minimum

---

## 23. Non-Negotiable Quality Standards

- **Zero hardcoded credentials** — everything from env vars
- **TypeScript strict mode** — `strict: true` in tsconfig, no `any` without comment
- **All API inputs validated** — Zod schemas on every route
- **All DB queries include familyId** — no query returns data for wrong family
- **Credentials encrypted** — never stored plaintext, never logged
- **Error boundaries everywhere** — one connector failing must not break the family's whole sync
- **Graceful degradation** — if scraper hits CAPTCHA, mark ERROR and alert — don't crash
- **Idempotent syncs** — running sync twice produces same result (upsert, not insert)
- **Proper HTTP status codes** — 400 for validation, 401 for auth, 403 for authz, 404 for not found, 429 for rate limit
- **Structured logging** — JSON logs with level, service, familyId (never userId+email together in same log line)

---

*End of spec. Build it.*

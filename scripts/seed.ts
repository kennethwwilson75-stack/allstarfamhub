/**
 * Seed script for All Star Fam Hub
 *
 * Run via: pnpm seed  (from repo root)
 * Or:      tsx ../scripts/seed.ts  (from packages/api)
 *
 * Idempotent — deletes existing demo data before re-seeding.
 */
 
import dotenv from 'dotenv';
import path from 'node:path';
 
dotenv.config({ path: path.resolve(__dirname, '../.env') });
 
import { PrismaClient } from '@prisma/client';
 
const prisma = new PrismaClient();
 
// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────
 
const DEMO_FAMILY_NAME = 'The Wilson Family';
 
function futureDate(days: number, hour = 0, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}
 
function nextWeekday(weekday: number, weeksAhead = 0): number {
  const today = new Date();
  const todayDay = today.getDay();
  let diff = weekday - todayDay;
  if (diff <= 0) diff += 7;
  return diff + weeksAhead * 7;
}
 
function log(msg: string): void {
  console.log(`  ✓ ${msg}`);
}
 
// ──────────────────────────────────────────────────────────────────
// Connector Definitions
// ──────────────────────────────────────────────────────────────────
 
async function seedConnectorDefinitions(): Promise<void> {
  console.log('\n🔌 Seeding ConnectorDefinitions...');
 
  const connectors = [
    { id: 'canvas', displayName: 'Canvas LMS', category: 'lms', methods: ['OAUTH_API'], sortOrder: 10 },
    { id: 'infinite-campus', displayName: 'Infinite Campus', category: 'gradebook', methods: ['WEB_SCRAPE'], sortOrder: 20 },
    { id: 'parentsquare', displayName: 'ParentSquare', category: 'school_comms', methods: ['ICAL_FEED', 'EMAIL_PARSE', 'WEB_SCRAPE'], sortOrder: 30 },
    { id: 'sportsyou', displayName: 'SportsYou', category: 'sports', methods: ['EMAIL_PARSE', 'WEB_SCRAPE'], sortOrder: 40 },
    { id: 'google-classroom', displayName: 'Google Classroom', category: 'lms', methods: ['OAUTH_API'], sortOrder: 50 },
    { id: 'remind', displayName: 'Remind', category: 'school_comms', methods: ['EMAIL_PARSE', 'WEB_SCRAPE'], sortOrder: 60 },
    { id: 'blackboard', displayName: 'Blackboard', category: 'lms', methods: ['WEB_SCRAPE'], sortOrder: 70 },
    { id: 'schoology', displayName: 'Schoology', category: 'lms', methods: ['OAUTH_API'], sortOrder: 80 },
    { id: 'ical-generic', displayName: 'Calendar Feed (iCal)', category: 'general', methods: ['ICAL_FEED'], sortOrder: 90 },
    { id: 'email-generic', displayName: 'Email Forwarding', category: 'general', methods: ['EMAIL_PARSE'], sortOrder: 100 },
  ] as const;
 
  for (const c of connectors) {
    await prisma.connectorDefinition.upsert({
      where: { id: c.id },
      update: { displayName: c.displayName, category: c.category, methods: [...c.methods], sortOrder: c.sortOrder },
      create: { id: c.id, displayName: c.displayName, category: c.category, methods: [...c.methods], sortOrder: c.sortOrder },
    });
  }
 
  log(`${connectors.length} connector definitions upserted`);
}
 
// ──────────────────────────────────────────────────────────────────
// Demo Family
// ──────────────────────────────────────────────────────────────────
 
async function seedDemoData(): Promise<void> {
  // ── Cleanup ────────────────────────────────────────────────────
  console.log('\n🧹 Cleaning existing demo data...');
 
  const existing = await prisma.family.findFirst({ where: { name: DEMO_FAMILY_NAME } });
  if (existing) {
    await prisma.family.delete({ where: { id: existing.id } });
    log('Deleted existing demo family and cascaded relations');
  }
 
  // ── Family ─────────────────────────────────────────────────────
  console.log('\n👨‍👩‍👧‍👦 Seeding demo family...');
 
  const family = await prisma.family.create({
    data: {
      name: DEMO_FAMILY_NAME,
      timezone: 'America/New_York',
      plan: 'FAMILY',
    },
  });
  log(`Family created: ${family.name} (${family.id})`);
 
  // ── User (Ken — your real account) ────────────────────────────
  console.log('\n👤 Seeding users...');
 
  const kenUser = await prisma.user.upsert({
    where: { supabaseId: '3a923755-252b-4cd3-b668-1ea84344a05a' },
    create: {
      email: 'kenwilson75@yahoo.com',
      supabaseId: '3a923755-252b-4cd3-b668-1ea84344a05a',
      displayName: 'Ken Wilson',
    },
    update: {
      displayName: 'Ken Wilson',
    },
  });
  log(`User: ${kenUser.displayName}`);
 
  // ── Family Members ─────────────────────────────────────────────
  console.log('\n👥 Seeding family members...');
 
  const ken = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: kenUser.id,
      role: 'ADMIN',
      displayName: 'Ken',
      color: '#1D9E75',
    },
  });
  log(`Member: ${ken.displayName} (ADMIN)`);
 
  // Sarah has no login account — just a member record
  const sarah = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      role: 'PARENT',
      displayName: 'Sarah',
      color: '#378ADD',
    },
  });
  log(`Member: ${sarah.displayName} (PARENT)`);
 
  const emma = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      role: 'CHILD',
      displayName: 'Emma',
      color: '#D85A30',
      grade: '10',
      schoolName: 'Lincoln High School',
    },
  });
  log(`Member: ${emma.displayName} (CHILD, grade ${emma.grade})`);
 
  const jake = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      role: 'CHILD',
      displayName: 'Jake',
      color: '#EF9F27',
      grade: '7',
      schoolName: 'Jefferson Middle School',
    },
  });
  log(`Member: ${jake.displayName} (CHILD, grade ${jake.grade})`);
 
  // ── Integrations ───────────────────────────────────────────────
  console.log('\n🔗 Seeding integrations...');
 
  const emmaCanvas = await prisma.integration.create({
    data: {
      familyId: family.id,
      memberId: emma.id,
      connectorId: 'canvas',
      method: 'OAUTH_API',
      status: 'ACTIVE',
      displayName: "Emma's Canvas",
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  log(`Integration: ${emmaCanvas.displayName}`);
 
  const emmaTrack = await prisma.integration.create({
    data: {
      familyId: family.id,
      memberId: emma.id,
      connectorId: 'sportsyou',
      method: 'EMAIL_PARSE',
      status: 'ACTIVE',
      displayName: "Emma's Track Team",
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  log(`Integration: ${emmaTrack.displayName}`);
 
  const jakeCanvas = await prisma.integration.create({
    data: {
      familyId: family.id,
      memberId: jake.id,
      connectorId: 'canvas',
      method: 'OAUTH_API',
      status: 'ACTIVE',
      displayName: "Jake's Canvas",
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  log(`Integration: ${jakeCanvas.displayName}`);
 
  const jakeSoccer = await prisma.integration.create({
    data: {
      familyId: family.id,
      memberId: jake.id,
      connectorId: 'sportsyou',
      method: 'EMAIL_PARSE',
      status: 'ACTIVE',
      displayName: "Jake's Soccer",
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  log(`Integration: ${jakeSoccer.displayName}`);
 
  const schoolAnnouncements = await prisma.integration.create({
    data: {
      familyId: family.id,
      connectorId: 'parentsquare',
      method: 'ICAL_FEED',
      status: 'ACTIVE',
      displayName: 'School Announcements',
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  log(`Integration: ${schoolAnnouncements.displayName}`);
 
  const gradeReports = await prisma.integration.create({
    data: {
      familyId: family.id,
      connectorId: 'infinite-campus',
      method: 'WEB_SCRAPE',
      status: 'ACTIVE',
      displayName: 'Grade Reports',
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  log(`Integration: ${gradeReports.displayName}`);
 
  // ── Events ─────────────────────────────────────────────────────
  console.log('\n📅 Seeding events...');
 
  interface EventSeed {
    title: string;
    eventType: 'ASSIGNMENT' | 'EXAM' | 'SCHOOL_EVENT' | 'NO_SCHOOL' | 'SPORTS' | 'MEETING' | 'ANNOUNCEMENT' | 'PERSONAL';
    startAt: Date;
    endAt?: Date;
    allDay?: boolean;
    location?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    deadlineAt?: Date;
    gradeWeight?: number;
    requiresSignup?: boolean;
    signupUrl?: string;
    description?: string;
    sourceIntegrationId?: string;
    memberIds: string[];
  }
 
  const events: EventSeed[] = [];
 
  // ─── Emma's Assignments (20) ──────────────────────────────────
  const emmaAssignments = [
    { title: 'AP History Essay: Causes of the Civil War', day: 1, weight: 15 },
    { title: 'Chemistry Lab Report: Titration Experiment', day: 2, weight: 10 },
    { title: 'Calculus Problem Set #14', day: 3, weight: 5 },
    { title: 'English Literature Response: The Great Gatsby Ch 5-7', day: 4, weight: 8 },
    { title: 'Spanish Vocabulary Quiz Prep', day: 5, weight: 3 },
    { title: 'AP History Primary Source Analysis', day: 7, weight: 10 },
    { title: 'Chemistry Worksheet: Acid-Base Reactions', day: 8, weight: 5 },
    { title: 'Calculus Integration Practice', day: 10, weight: 5 },
    { title: 'English Persuasive Essay Draft', day: 11, weight: 12 },
    { title: 'Biology Cell Division Diagram', day: 12, weight: 8 },
    { title: 'AP History Document-Based Question', day: 14, weight: 15 },
    { title: 'Chemistry Molecular Structure Models', day: 15, weight: 7 },
    { title: 'Calculus Derivatives Worksheet', day: 17, weight: 5 },
    { title: 'English Poetry Analysis: Robert Frost', day: 18, weight: 8 },
    { title: 'Spanish Written Composition', day: 19, weight: 10 },
    { title: 'AP History Map Activity: Reconstruction', day: 21, weight: 5 },
    { title: 'Chemistry Pre-Lab Questions', day: 22, weight: 3 },
    { title: 'Calculus Review Problems Ch 6', day: 24, weight: 5 },
    { title: 'English Research Paper Outline', day: 26, weight: 10 },
    { title: 'Biology Lab Report: Osmosis', day: 28, weight: 10 },
  ];
 
  for (const a of emmaAssignments) {
    events.push({
      title: a.title,
      eventType: 'ASSIGNMENT',
      startAt: futureDate(a.day, 8, 0),
      deadlineAt: futureDate(a.day, 23, 59),
      gradeWeight: a.weight,
      priority: a.weight >= 12 ? 'HIGH' : 'NORMAL',
      sourceIntegrationId: emmaCanvas.id,
      memberIds: [emma.id],
    });
  }
 
  // ─── Emma's Exams (3) ─────────────────────────────────────────
  events.push({
    title: 'AP History Midterm Exam',
    eventType: 'EXAM',
    startAt: futureDate(9, 9, 0),
    endAt: futureDate(9, 11, 0),
    location: 'Room 204, Lincoln High School',
    priority: 'URGENT',
    gradeWeight: 25,
    sourceIntegrationId: emmaCanvas.id,
    memberIds: [emma.id],
  });
  events.push({
    title: 'Chemistry Unit Test: Solutions & Equilibrium',
    eventType: 'EXAM',
    startAt: futureDate(16, 10, 30),
    endAt: futureDate(16, 12, 0),
    location: 'Room 118, Lincoln High School',
    priority: 'HIGH',
    gradeWeight: 20,
    sourceIntegrationId: emmaCanvas.id,
    memberIds: [emma.id],
  });
  events.push({
    title: 'Calculus Quiz: Integration by Parts',
    eventType: 'EXAM',
    startAt: futureDate(20, 14, 0),
    endAt: futureDate(20, 14, 45),
    location: 'Room 310, Lincoln High School',
    priority: 'HIGH',
    gradeWeight: 10,
    sourceIntegrationId: emmaCanvas.id,
    memberIds: [emma.id],
  });
 
  // ─── Jake's Assignments (15) ──────────────────────────────────
  const jakeAssignments = [
    { title: 'Math Word Problems: Fractions and Decimals', day: 1, weight: 5 },
    { title: 'Science Fair Project Proposal', day: 2, weight: 15 },
    { title: 'English Book Report: Hatchet', day: 4, weight: 12 },
    { title: 'Social Studies Map Skills Worksheet', day: 5, weight: 5 },
    { title: 'Math Quiz Review: Percentages', day: 7, weight: 3 },
    { title: 'Science Lab: Simple Machines', day: 9, weight: 10 },
    { title: 'English Vocabulary Sentences', day: 11, weight: 5 },
    { title: 'Social Studies Timeline Project', day: 13, weight: 12 },
    { title: 'Math Chapter 8 Test Review', day: 15, weight: 5 },
    { title: 'Science Ecosystem Poster', day: 17, weight: 10 },
    { title: 'English Creative Writing Story', day: 19, weight: 8 },
    { title: 'Math Geometry Constructions', day: 21, weight: 5 },
    { title: 'Social Studies Current Events Report', day: 23, weight: 8 },
    { title: 'Science Weather Journal Week 4', day: 25, weight: 5 },
    { title: 'English Grammar Practice: Clauses', day: 27, weight: 5 },
  ];
 
  for (const a of jakeAssignments) {
    events.push({
      title: a.title,
      eventType: 'ASSIGNMENT',
      startAt: futureDate(a.day, 8, 0),
      deadlineAt: futureDate(a.day, 23, 59),
      gradeWeight: a.weight,
      priority: a.weight >= 12 ? 'HIGH' : 'NORMAL',
      sourceIntegrationId: jakeCanvas.id,
      memberIds: [jake.id],
    });
  }
 
  // ─── Emma's Track Meets (8) ───────────────────────────────────
  const trackMeets = [
    { title: 'Varsity Track: Lincoln vs. Washington', day: 3, location: 'Lincoln Stadium' },
    { title: 'JV/Varsity Track: Tri-Meet at Roosevelt', day: 6, location: 'Roosevelt Athletic Complex' },
    { title: 'Track: County Invitational', day: 10, location: 'County Fairgrounds Track' },
    { title: 'Varsity Track: Lincoln vs. Adams', day: 13, location: 'Lincoln Stadium' },
    { title: 'Track: Regional Qualifier', day: 17, location: 'Westfield Sports Center' },
    { title: 'Varsity Track: Dual Meet at Monroe', day: 20, location: 'Monroe High School Track' },
    { title: 'Track: Conference Championships', day: 24, location: 'State University Track Complex' },
    { title: 'Track: District Prelims', day: 28, location: 'Metro Sports Arena' },
  ];
 
  for (const m of trackMeets) {
    events.push({
      title: m.title,
      eventType: 'SPORTS',
      startAt: futureDate(m.day, 15, 30),
      endAt: futureDate(m.day, 18, 0),
      location: m.location,
      priority: 'NORMAL',
      sourceIntegrationId: emmaTrack.id,
      memberIds: [emma.id],
    });
  }
 
  // ─── Emma's Track Practices (MWF for 4 weeks) ─────────────────
  for (let week = 0; week < 4; week++) {
    for (const day of [1, 3, 5]) {
      const offset = nextWeekday(day, week);
      if (offset <= 30) {
        events.push({
          title: 'Track Practice',
          eventType: 'SPORTS',
          startAt: futureDate(offset, 15, 30),
          endAt: futureDate(offset, 17, 0),
          location: 'Lincoln High School Track',
          priority: 'LOW',
          sourceIntegrationId: emmaTrack.id,
          memberIds: [emma.id],
        });
      }
    }
  }
 
  // ─── Jake's Soccer Games (12) ─────────────────────────────────
  const soccerGames = [
    { title: 'Boys Soccer: Jefferson vs. Hamilton', day: 2, location: 'Jefferson Middle School Field' },
    { title: 'Boys Soccer: Jefferson vs. Madison', day: 5, location: 'Madison Middle School' },
    { title: 'Boys Soccer: Jefferson vs. Franklin', day: 8, location: 'Jefferson Middle School Field' },
    { title: 'Boys Soccer: Tournament Game 1', day: 10, location: 'Riverside Soccer Complex' },
    { title: 'Boys Soccer: Tournament Game 2', day: 11, location: 'Riverside Soccer Complex' },
    { title: 'Boys Soccer: Jefferson vs. Monroe', day: 14, location: 'Monroe Middle School' },
    { title: 'Boys Soccer: Jefferson vs. Lincoln JV', day: 17, location: 'Jefferson Middle School Field' },
    { title: 'Boys Soccer: Jefferson vs. Adams', day: 20, location: 'Adams Athletic Fields' },
    { title: 'Boys Soccer: Jefferson vs. Washington', day: 23, location: 'Jefferson Middle School Field' },
    { title: 'Boys Soccer: Playoff Quarterfinal', day: 25, location: 'County Sports Complex' },
    { title: 'Boys Soccer: Playoff Semifinal', day: 27, location: 'County Sports Complex' },
    { title: 'Boys Soccer: Championship Game', day: 29, location: 'Metro Stadium' },
  ];
 
  for (const g of soccerGames) {
    events.push({
      title: g.title,
      eventType: 'SPORTS',
      startAt: futureDate(g.day, 16, 0),
      endAt: futureDate(g.day, 17, 30),
      location: g.location,
      priority: 'NORMAL',
      sourceIntegrationId: jakeSoccer.id,
      memberIds: [jake.id],
    });
  }
 
  // ─── Jake's Soccer Practices (TTh + Sat for 4 weeks) ──────────
  for (let week = 0; week < 4; week++) {
    for (const day of [2, 4]) {
      const offset = nextWeekday(day, week);
      if (offset <= 30) {
        events.push({
          title: 'Soccer Practice',
          eventType: 'SPORTS',
          startAt: futureDate(offset, 16, 0),
          endAt: futureDate(offset, 17, 30),
          location: 'Jefferson Middle School Field',
          priority: 'LOW',
          sourceIntegrationId: jakeSoccer.id,
          memberIds: [jake.id],
        });
      }
    }
    const satOffset = nextWeekday(6, week);
    if (satOffset <= 30) {
      events.push({
        title: 'Soccer Practice',
        eventType: 'SPORTS',
        startAt: futureDate(satOffset, 9, 0),
        endAt: futureDate(satOffset, 10, 30),
        location: 'Jefferson Middle School Field',
        priority: 'LOW',
        sourceIntegrationId: jakeSoccer.id,
        memberIds: [jake.id],
      });
    }
  }
 
  // ─── School Events ─────────────────────────────────────────────
  events.push({
    title: 'Professional Development Day — Early Release',
    eventType: 'SCHOOL_EVENT',
    startAt: futureDate(6, 8, 0),
    endAt: futureDate(6, 12, 0),
    description: 'Students dismissed at noon. No afternoon classes.',
    priority: 'HIGH',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [emma.id, jake.id],
  });
 
  events.push({
    title: 'Parent-Teacher Conference Night',
    eventType: 'MEETING',
    startAt: futureDate(12, 18, 0),
    endAt: futureDate(12, 21, 0),
    location: 'Lincoln High School Gymnasium',
    description: 'Sign up for 15-minute slots with teachers.',
    priority: 'HIGH',
    requiresSignup: true,
    signupUrl: 'https://ptcfast.com/schools/lincoln-high',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [ken.id, sarah.id, emma.id],
  });
 
  events.push({
    title: 'Spring Arts Festival',
    eventType: 'SCHOOL_EVENT',
    startAt: futureDate(19, 17, 0),
    endAt: futureDate(19, 20, 0),
    location: 'Lincoln High School Auditorium',
    description: 'Student art exhibits, choir and band performances.',
    priority: 'NORMAL',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [emma.id, ken.id, sarah.id],
  });
 
  events.push({
    title: 'Jefferson Middle School Science Fair',
    eventType: 'SCHOOL_EVENT',
    startAt: futureDate(22, 9, 0),
    endAt: futureDate(22, 14, 0),
    location: 'Jefferson Middle School Cafeteria',
    description: 'All 7th graders present their science fair projects.',
    priority: 'HIGH',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [jake.id, ken.id, sarah.id],
  });
 
  events.push({
    title: 'School Board Community Forum',
    eventType: 'ANNOUNCEMENT',
    startAt: futureDate(26, 19, 0),
    endAt: futureDate(26, 21, 0),
    location: 'District Admin Building, Room 101',
    description: 'Open forum on next year budget and calendar.',
    priority: 'LOW',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [ken.id, sarah.id],
  });
 
  events.push({
    title: 'No School — Teacher In-Service Day',
    eventType: 'NO_SCHOOL',
    startAt: futureDate(15, 0, 0),
    allDay: true,
    priority: 'NORMAL',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [emma.id, jake.id],
  });
 
  events.push({
    title: 'No School — Spring Break Begins',
    eventType: 'NO_SCHOOL',
    startAt: futureDate(29, 0, 0),
    allDay: true,
    priority: 'NORMAL',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [emma.id, jake.id],
  });
 
  // ─── Personal Family Event ─────────────────────────────────────
  events.push({
    title: "Grandma's Birthday Dinner",
    eventType: 'PERSONAL',
    startAt: futureDate(18, 18, 0),
    endAt: futureDate(18, 21, 0),
    location: 'Olive Garden, 123 Main St',
    description: 'Reservation under Wilson, party of 6.',
    priority: 'HIGH',
    memberIds: [ken.id, sarah.id, emma.id, jake.id],
  });
 
  // ─── Conflict Events ───────────────────────────────────────────
  events.push({
    title: 'Mandatory Academic Awards Assembly',
    eventType: 'SCHOOL_EVENT',
    startAt: futureDate(10, 15, 0),
    endAt: futureDate(10, 16, 30),
    location: 'Lincoln High School Auditorium',
    priority: 'HIGH',
    sourceIntegrationId: schoolAnnouncements.id,
    memberIds: [emma.id],
  });
 
  events.push({
    title: 'Math Tutoring Session',
    eventType: 'MEETING',
    startAt: futureDate(14, 15, 30),
    endAt: futureDate(14, 17, 0),
    location: 'Jefferson Middle School Library',
    priority: 'HIGH',
    sourceIntegrationId: jakeCanvas.id,
    memberIds: [jake.id],
  });
 
  events.push({
    title: "Emma's Track Team Banquet",
    eventType: 'SPORTS',
    startAt: futureDate(18, 17, 30),
    endAt: futureDate(18, 20, 0),
    location: "Coach's Grill Restaurant",
    sourceIntegrationId: emmaTrack.id,
    memberIds: [emma.id],
  });
 
  events.push({
    title: "Jake's Soccer Team Pizza Party",
    eventType: 'SPORTS',
    startAt: futureDate(18, 18, 0),
    endAt: futureDate(18, 20, 0),
    location: 'Pizza Palace, 456 Oak Ave',
    sourceIntegrationId: jakeSoccer.id,
    memberIds: [jake.id],
  });
 
  // ── Bulk insert events ─────────────────────────────────────────
  let eventCount = 0;
 
  await prisma.$transaction(async (tx) => {
    for (const e of events) {
      const created = await tx.familyEvent.create({
        data: {
          familyId: family.id,
          title: e.title,
          eventType: e.eventType,
          startAt: e.startAt,
          endAt: e.endAt ?? null,
          allDay: e.allDay ?? false,
          location: e.location ?? null,
          description: e.description ?? null,
          priority: e.priority ?? 'NORMAL',
          status: 'ACTIVE',
          deadlineAt: e.deadlineAt ?? null,
          gradeWeight: e.gradeWeight ?? null,
          requiresSignup: e.requiresSignup ?? false,
          signupUrl: e.signupUrl ?? null,
          sourceIntegrationId: e.sourceIntegrationId ?? null,
          sourceItemId: e.sourceIntegrationId ? `seed-${eventCount}` : null,
          externalId: e.sourceIntegrationId ? `ext-seed-${eventCount}` : null,
        },
      });
 
      for (const memberId of e.memberIds) {
        await tx.eventMember.create({
          data: { eventId: created.id, memberId },
        });
      }
 
      eventCount++;
    }
  }, { timeout: 60000 });
 
  log(`${eventCount} events created with member links`);
 
  // ── Alerts ─────────────────────────────────────────────────────
  console.log('\n🔔 Seeding alerts...');
 
  const jakesSoccerEvent = await prisma.familyEvent.findFirst({
    where: { familyId: family.id, title: { contains: 'Jefferson vs. Hamilton' } },
  });
  const emmaEssayEvent = await prisma.familyEvent.findFirst({
    where: { familyId: family.id, title: { contains: 'AP History Essay' } },
  });
  const ptcEvent = await prisma.familyEvent.findFirst({
    where: { familyId: family.id, title: { contains: 'Parent-Teacher Conference' } },
  });
 
  await prisma.alert.createMany({
    data: [
      {
        familyId: family.id,
        eventId: jakesSoccerEvent?.id ?? null,
        type: 'LOCATION_CHANGED',
        title: "Jake's soccer game moved to Field B",
        body: "The Jefferson vs. Hamilton game has been relocated from the main field to Field B due to field maintenance.",
        priority: 'NORMAL',
      },
      {
        familyId: family.id,
        eventId: emmaEssayEvent?.id ?? null,
        type: 'DEADLINE_TODAY',
        title: "Emma's AP History Essay due today",
        body: "The 'AP History Essay: Causes of the Civil War' assignment is due by 11:59 PM tonight.",
        priority: 'HIGH',
      },
      {
        familyId: family.id,
        eventId: ptcEvent?.id ?? null,
        type: 'SIGNUP_NEEDED',
        title: 'Parent-Teacher Conference sign-up open',
        body: 'Sign up for 15-minute slots with teachers at Lincoln High School. Slots fill up quickly!',
        priority: 'NORMAL',
        actionUrl: 'https://ptcfast.com/schools/lincoln-high',
      },
      {
        familyId: family.id,
        type: 'GRADE_POSTED',
        title: "Jake's Math test grade posted",
        body: "A new grade has been posted for Jake in Math: Chapter 7 Test. Check Infinite Campus for details.",
        priority: 'NORMAL',
      },
    ],
  });
 
  log('4 alerts created (all unread)');
 
  // ── Notification Preferences ───────────────────────────────────
  console.log('\n⚙️  Seeding notification preferences...');
 
  await prisma.notificationPreferences.create({
    data: {
      familyId: family.id,
      memberId: ken.id,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      notifyEventAdded: true,
      notifyEventChanged: true,
      notifyLocationChanged: true,
      notifyDeadlineToday: true,
      notifyDeadlineTomorrow: true,
      notifyGradePosted: false,
      notifyConflict: true,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      dailyDigestEnabled: false,
      dailyDigestTime: '07:00',
    },
  });
 
  log('Notification preferences created for Ken');
}
 
// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────
 
async function main(): Promise<void> {
  console.log('🌱 Starting All Star Fam Hub seed...');
  await seedConnectorDefinitions();
  await seedDemoData();
  console.log('\n✅ Seed complete!\n');
}
 
main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
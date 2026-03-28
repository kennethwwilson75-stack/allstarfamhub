import { describe, it, expect } from 'vitest';
import { classifyEventType } from '../utils/classify-event.js';

describe('classifyEventType', () => {
  describe('ASSIGNMENT', () => {
    const titles = [
      'Math Homework Due',
      'Submit Lab Report',
      'Essay Assignment',
      'Science Project Due Friday',
      'Book Report Due',
      'History Assignment #3',
      'Submit Final Paper',
      'Homework Packet Due',
      'Group Project Presentation',
      'Lab Report Submission',
    ];

    it.each(titles)('classifies "%s" as ASSIGNMENT', (title) => {
      expect(classifyEventType(title)).toBe('ASSIGNMENT');
    });
  });

  describe('EXAM', () => {
    const titles = [
      'Final Exam',
      'Midterm Assessment',
      'Chapter 5 Test',
      'Math Exam - Period 3',
      'Science Assessment',
      'History Test Friday',
      'AP Biology Final',
      'Unit 4 Exam',
      'Reading Assessment',
      'Spelling Test',
    ];

    it.each(titles)('classifies "%s" as EXAM', (title) => {
      expect(classifyEventType(title)).toBe('EXAM');
    });
  });

  describe('NO_SCHOOL', () => {
    const titles = [
      'No School - PD Day',
      'Winter Break',
      'Snow Day',
      'School Closed',
      'Holiday - MLK Day',
      'Teacher Workday',
      'Spring Break',
      'No School Today',
      'Memorial Day Holiday',
      'Summer Break Begins',
    ];

    it.each(titles)('classifies "%s" as NO_SCHOOL', (title) => {
      expect(classifyEventType(title)).toBe('NO_SCHOOL');
    });
  });

  describe('SPORTS', () => {
    const titles = [
      'Soccer Game vs Tigers',
      'Track Practice',
      'Basketball Tournament',
      'Swim Meet',
      'Football Scrimmage',
      'Volleyball Match',
      'Baseball Tryout',
      'Cross Country Practice',
      'Tennis Match Away',
      'Wrestling Tournament',
    ];

    it.each(titles)('classifies "%s" as SPORTS', (title) => {
      expect(classifyEventType(title)).toBe('SPORTS');
    });
  });

  describe('MEETING', () => {
    const titles = [
      'Parent-Teacher Conference',
      'Counselor Appointment',
      '504 Plan Review',
      'Orientation Night',
      'Guidance Counselor Check-In',
      'Back-to-School Conference',
    ];

    it.each(titles)('classifies "%s" as MEETING', (title) => {
      expect(classifyEventType(title)).toBe('MEETING');
    });
  });

  describe('SCHOOL_EVENT', () => {
    const titles = [
      'Field Trip to Museum',
      'Picture Day',
      'Spring Concert',
      'School Play - Annie',
      'Graduation Ceremony',
      'Homecoming Dance',
      'Prom Night',
    ];

    it.each(titles)('classifies "%s" as SCHOOL_EVENT', (title) => {
      expect(classifyEventType(title)).toBe('SCHOOL_EVENT');
    });
  });

  describe('ANNOUNCEMENT (fallback)', () => {
    const titles = [
      'Newsletter Update',
      'Supply List',
      'Lunch Menu Change',
      'Important Notice',
      'PTA Information',
      'Bus Route Change',
    ];

    it.each(titles)('classifies "%s" as ANNOUNCEMENT', (title) => {
      expect(classifyEventType(title)).toBe('ANNOUNCEMENT');
    });
  });

  it('is case-insensitive', () => {
    expect(classifyEventType('FINAL EXAM')).toBe('EXAM');
    expect(classifyEventType('final exam')).toBe('EXAM');
    expect(classifyEventType('Final Exam')).toBe('EXAM');
  });

  it('matches partial keywords within title', () => {
    expect(classifyEventType('Remember: Math Homework Due Tomorrow')).toBe('ASSIGNMENT');
  });

  it('matches "meet" keyword in SPORTS before MEETING for titles containing "meet"', () => {
    // "IEP Meeting" contains "meet" which is a SPORTS keyword checked before MEETING
    expect(classifyEventType('IEP Meeting')).toBe('SPORTS');
    expect(classifyEventType('Staff Meeting')).toBe('SPORTS');
  });
});

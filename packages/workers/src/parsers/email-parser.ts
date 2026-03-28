import { Worker, type Job } from 'bullmq';
import { getRedis } from '../lib/redis.js';
import { getPrisma } from '../lib/prisma.js';
import { PARSE_QUEUE, type ParseJobData } from '../queues.js';
import { classifyEventType, computePriority } from '@allstarfamhub/shared';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-haiku-20240307';

interface ParsedEvent {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  location?: string;
  eventType?: string;
  deadlineDate?: string;
  requiresSignup?: boolean;
  signupUrl?: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

const SYSTEM_PROMPT = `You are an AI assistant that extracts calendar events from school and family-related emails.

Given an email subject and body, extract ALL events, assignments, deadlines, and announcements.

Return a JSON array of events with these fields:
- title (string, required): concise event name
- description (string, optional): brief description
- startDate (string, optional): ISO 8601 date/datetime if mentioned
- endDate (string, optional): ISO 8601 date/datetime if mentioned
- allDay (boolean, optional): true if no specific time mentioned
- location (string, optional): venue or address
- eventType (string, optional): one of ASSIGNMENT, EXAM, SCHOOL_EVENT, NO_SCHOOL, SPORTS, MEETING, ANNOUNCEMENT, PERSONAL
- deadlineDate (string, optional): ISO 8601 for due dates
- requiresSignup (boolean, optional): if parent/student action needed
- signupUrl (string, optional): URL for signup if mentioned

Return ONLY valid JSON array, no explanation. If no events found, return [].`;

/**
 * Call Claude API to parse email content into structured events.
 */
async function callClaude(
  subject: string,
  body: string,
): Promise<{ events: ParsedEvent[]; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const userMessage = `Subject: ${subject}\n\nBody:\n${body}`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  const textContent = data.content.find((c) => c.type === 'text');
  const rawText = textContent?.text ?? '[]';

  // Parse JSON from response — handle potential markdown wrapping
  let jsonStr = rawText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const events = JSON.parse(jsonStr) as ParsedEvent[];
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;

  return { events, inputTokens, outputTokens };
}

async function processParseJob(job: Job<ParseJobData>): Promise<void> {
  const prisma = getPrisma();
  const { rawItemId, integrationId, familyId, emailSubject, emailBody, memberId } = job.data;

  console.log(`[email-parser] Processing parse for rawItem=${rawItemId}`);

  try {
    // Call Claude for extraction
    const { events: parsedEvents, inputTokens, outputTokens } = await callClaude(
      emailSubject,
      emailBody,
    );

    const totalTokens = inputTokens + outputTokens;
    // Haiku pricing: ~$0.25/1M input, $1.25/1M output (in millionths of USD)
    const costUsdMil = Math.round(inputTokens * 0.25 + outputTokens * 1.25);

    // Track LLM usage
    const today = new Date().toISOString().slice(0, 10);
    await prisma.llmUsage.upsert({
      where: {
        familyId_date: { familyId, date: today },
      },
      update: {
        callCount: { increment: 1 },
        tokenCount: { increment: totalTokens },
        costUsdMil: { increment: costUsdMil },
      },
      create: {
        familyId,
        date: today,
        callCount: 1,
        tokenCount: totalTokens,
        costUsdMil,
      },
    });

    // Create/update FamilyEvents from parsed data
    for (const parsed of parsedEvents) {
      const eventType = parsed.eventType
        ? (parsed.eventType as ReturnType<typeof classifyEventType>)
        : classifyEventType(parsed.title);

      const startAt = parsed.startDate ? new Date(parsed.startDate) : new Date();
      const priority = computePriority(
        startAt,
        parsed.deadlineDate ? new Date(parsed.deadlineDate) : null,
      );

      const eventData = {
        familyId,
        sourceIntegrationId: integrationId,
        sourceItemId: rawItemId,
        title: parsed.title,
        description: parsed.description ?? null,
        eventType,
        startAt,
        endAt: parsed.endDate ? new Date(parsed.endDate) : null,
        allDay: parsed.allDay ?? !parsed.startDate?.includes('T'),
        location: parsed.location ?? null,
        priority,
        status: 'ACTIVE' as const,
        deadlineAt: parsed.deadlineDate ? new Date(parsed.deadlineDate) : null,
        requiresSignup: parsed.requiresSignup ?? false,
        signupUrl: parsed.signupUrl ?? null,
      };

      const event = await prisma.familyEvent.create({ data: eventData });

      // Link to member if specified
      if (memberId) {
        await prisma.eventMember.create({
          data: { eventId: event.id, memberId },
        });
      }
    }

    // Mark RawItem as processed
    await prisma.rawItem.update({
      where: { id: rawItemId },
      data: {
        parsedAt: new Date(),
        processedAt: new Date(),
        parseError: null,
      },
    });

    console.log(
      `[email-parser] Parsed ${parsedEvents.length} events from rawItem=${rawItemId} (${totalTokens} tokens)`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email-parser] Parse failed for rawItem=${rawItemId}:`, message);

    await prisma.rawItem.update({
      where: { id: rawItemId },
      data: { parseError: message },
    });

    throw err;
  }
}

/**
 * Create and return the email-parser worker.
 */
export function createParseWorker(): Worker<ParseJobData> {
  const worker = new Worker<ParseJobData>(PARSE_QUEUE, processParseJob, {
    connection: getRedis(),
    concurrency: 3,
  });

  worker.on('completed', (job) => {
    console.log(`[email-parser] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[email-parser] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

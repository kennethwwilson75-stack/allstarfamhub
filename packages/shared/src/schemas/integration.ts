import { z } from 'zod';

export const createIntegrationSchema = z.object({
  connectorId: z.string().min(1).max(100),
  memberId: z.string().optional(),
  method: z.enum(['OAUTH_API', 'ICAL_FEED', 'EMAIL_PARSE', 'WEB_SCRAPE', 'MANUAL']),
  displayName: z.string().min(1).max(200),
  credentials: z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
      feedUrl: z.string().url().optional(),
      customFields: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  scraperConfig: z.record(z.string(), z.unknown()).optional(),
});

export const updateIntegrationSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  syncIntervalMin: z.number().int().min(5).max(1440).optional(),
  scraperConfig: z.record(z.string(), z.unknown()).optional(),
});

import type { FastifyInstance } from 'fastify';
import {
  createIntegrationSchema,
  updateIntegrationSchema,
} from '@allstarfamhub/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireParentOrAdmin } from '../lib/auth.js';
import { encrypt } from '../lib/encryption.js';

export default async function integrationRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook('preHandler', authenticate);

  /**
   * GET /integrations - List integrations for the family
   */
  app.get('/integrations', async (request, reply) => {
    const integrations = await prisma.integration.findMany({
      where: { familyId: request.auth.familyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        memberId: true,
        connectorId: true,
        method: true,
        status: true,
        displayName: true,
        feedUrl: true,
        ingestEmail: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        nextSyncAt: true,
        syncIntervalMin: true,
        createdAt: true,
        updatedAt: true,
        // Exclude sensitive fields: credentialsEnc, accessToken, refreshToken
      },
    });

    return reply.send({ data: integrations });
  });

  /**
   * POST /integrations - Create a new integration
   */
  app.post(
    '/integrations',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const parsed = createIntegrationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const familyId = request.auth.familyId;
      const { credentials, scraperConfig, ...data } = parsed.data;

      // Verify the connector exists
      const connector = await prisma.connectorDefinition.findUnique({
        where: { id: data.connectorId },
      });

      if (!connector) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Connector "${data.connectorId}" not found`,
          statusCode: 404,
        });
      }

      // Generate a temp ID for encryption context (will be replaced by actual ID)
      const tempId = crypto.randomUUID();

      const integration = await prisma.integration.create({
        data: {
          familyId,
          memberId: data.memberId,
          connectorId: data.connectorId,
          method: data.method,
          displayName: data.displayName,
          credentialsEnc: credentials
            ? encrypt(JSON.stringify(credentials), familyId, tempId)
            : null,
          feedUrl: credentials?.feedUrl,
          // Prisma InputJsonValue needs explicit cast from Record<string, unknown>
          scraperConfig: scraperConfig
            ? (JSON.parse(JSON.stringify(scraperConfig)) as object)
            : undefined,
          status: 'PENDING',
        },
      });

      // Re-encrypt with real integration ID if credentials were provided
      if (credentials) {
        const reEncrypted = encrypt(
          JSON.stringify(credentials),
          familyId,
          integration.id,
        );
        await prisma.integration.update({
          where: { id: integration.id },
          data: { credentialsEnc: reEncrypted },
        });
      }

      return reply.status(201).send({
        data: {
          id: integration.id,
          familyId: integration.familyId,
          memberId: integration.memberId,
          connectorId: integration.connectorId,
          method: integration.method,
          status: integration.status,
          displayName: integration.displayName,
          createdAt: integration.createdAt,
        },
      });
    },
  );

  /**
   * GET /integrations/:id - Get integration details
   */
  app.get<{ Params: { id: string } }>(
    '/integrations/:id',
    async (request, reply) => {
      const integration = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
        select: {
          id: true,
          familyId: true,
          memberId: true,
          connectorId: true,
          method: true,
          status: true,
          displayName: true,
          feedUrl: true,
          ingestEmail: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          lastSyncError: true,
          nextSyncAt: true,
          syncIntervalMin: true,
          scraperConfig: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      return reply.send({ data: integration });
    },
  );

  /**
   * PATCH /integrations/:id - Update integration settings
   */
  app.patch<{ Params: { id: string } }>(
    '/integrations/:id',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const parsed = updateIntegrationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          statusCode: 400,
          details: parsed.error.flatten(),
        });
      }

      const existing = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      const integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.displayName !== undefined && {
            displayName: parsed.data.displayName,
          }),
          ...(parsed.data.status !== undefined && { status: parsed.data.status }),
          ...(parsed.data.syncIntervalMin !== undefined && {
            syncIntervalMin: parsed.data.syncIntervalMin,
          }),
          ...(parsed.data.scraperConfig !== undefined && {
            scraperConfig: JSON.parse(JSON.stringify(parsed.data.scraperConfig)) as object,
          }),
        },
        select: {
          id: true,
          familyId: true,
          connectorId: true,
          method: true,
          status: true,
          displayName: true,
          syncIntervalMin: true,
          updatedAt: true,
        },
      });

      return reply.send({ data: integration });
    },
  );

  /**
   * DELETE /integrations/:id - Remove an integration
   */
  app.delete<{ Params: { id: string } }>(
    '/integrations/:id',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const existing = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      await prisma.integration.delete({
        where: { id: existing.id },
      });

      return reply.status(204).send();
    },
  );

  /**
   * POST /integrations/:id/sync - Trigger a manual sync
   */
  app.post<{ Params: { id: string } }>(
    '/integrations/:id/sync',
    { preHandler: [requireParentOrAdmin] },
    async (request, reply) => {
      const integration = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      // TODO: Enqueue a BullMQ sync job instead of running inline
      // For now, mark as queued
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncStatus: 'QUEUED',
          nextSyncAt: new Date(),
        },
      });

      return reply.status(202).send({
        data: {
          message: 'Sync queued',
          integrationId: integration.id,
        },
      });
    },
  );

  /**
   * GET /integrations/ingest-email - Get the family's email ingest address
   */
  app.get('/integrations/ingest-email', async (request, reply) => {
    const integrations = await prisma.integration.findMany({
      where: {
        familyId: request.auth.familyId,
        method: 'EMAIL_PARSE',
      },
      select: {
        id: true,
        displayName: true,
        ingestEmail: true,
      },
    });

    return reply.send({ data: integrations });
  });

  /**
   * GET /integrations/:id/logs - Recent sync log for an integration
   */
  app.get<{ Params: { id: string } }>(
    '/integrations/:id/logs',
    async (request, reply) => {
      const integration = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      // Return recent raw items as log entries
      const logs = await prisma.rawItem.findMany({
        where: { integrationId: integration.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          sourceId: true,
          parsedAt: true,
          parseError: true,
          processedAt: true,
          createdAt: true,
        },
      });

      return reply.send({
        data: {
          integrationId: integration.id,
          lastSyncAt: integration.lastSyncAt,
          lastSyncStatus: integration.lastSyncStatus,
          lastSyncError: integration.lastSyncError,
          logs,
        },
      });
    },
  );

  /**
   * GET /integrations/:id/auth-url - Get OAuth URL for an integration
   */
  app.get<{ Params: { id: string } }>(
    '/integrations/:id/auth-url',
    async (request, reply) => {
      const integration = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      if (integration.method !== 'OAUTH_API') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Integration does not use OAuth',
          statusCode: 400,
        });
      }

      // TODO: Build real OAuth URL from connector.oauthConfigJson
      const authUrl = `https://oauth.example.com/authorize?integration_id=${integration.id}`;

      return reply.send({ data: { authUrl } });
    },
  );

  /**
   * POST /integrations/:id/auth-callback - Handle OAuth code exchange
   */
  app.post<{ Params: { id: string } }>(
    '/integrations/:id/auth-callback',
    async (request, reply) => {
      const integration = await prisma.integration.findFirst({
        where: {
          id: request.params.id,
          familyId: request.auth.familyId,
        },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Integration not found',
          statusCode: 404,
        });
      }

      const { code } = request.body as { code?: string };
      if (!code) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Missing authorization code',
          statusCode: 400,
        });
      }

      // TODO: Exchange code for tokens using connector's OAuth config
      // For now, mark integration as active
      const updated = await prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'ACTIVE' },
      });

      return reply.send({
        data: {
          id: updated.id,
          status: updated.status,
        },
      });
    },
  );

  /**
   * GET /connectors - List available connector definitions
   */
  app.get('/connectors', async (_request, reply) => {
    const connectors = await prisma.connectorDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return reply.send({ data: connectors });
  });
}

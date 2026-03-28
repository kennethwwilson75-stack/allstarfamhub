import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';

interface EmailIngestPayload {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export default async function webhookRoutes(
  app: FastifyInstance,
): Promise<void> {
  /**
   * POST /webhooks/email-ingest - Receive parsed emails from SendGrid Inbound Parse
   */
  app.post('/webhooks/email-ingest', async (request, reply) => {
    const payload = request.body as EmailIngestPayload;

    if (!payload.to || !payload.subject) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing required fields: to, subject',
        statusCode: 400,
      });
    }

    // Extract the ingest email address (the "to" field)
    // Format: <unique-id>@ingest.allstarfamhub.com
    const toAddress = payload.to.toLowerCase();

    // Find the integration that uses this ingest email
    const integration = await prisma.integration.findFirst({
      where: {
        ingestEmail: toAddress,
        method: 'EMAIL_PARSE',
        status: 'ACTIVE',
      },
    });

    if (!integration) {
      // Silently accept to prevent email bounce loops
      app.log.warn(
        { to: toAddress },
        'Email received for unknown ingest address',
      );
      return reply.status(200).send({ accepted: true });
    }

    // Store as a raw item for processing
    const sourceId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await prisma.rawItem.create({
      data: {
        integrationId: integration.id,
        sourceId,
        rawPayload: {
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html ?? null,
          text: payload.text ?? null,
          receivedAt: new Date().toISOString(),
        },
      },
    });

    // TODO: Enqueue BullMQ job to process the raw item

    return reply.status(200).send({ accepted: true });
  });

  /**
   * POST /webhooks/stripe - Handle Stripe webhook events
   */
  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (!signature) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing stripe-signature header',
        statusCode: 400,
      });
    }

    // In production, verify the webhook signature using Stripe SDK.
    // For now, we do a basic check that the secret is configured.
    if (!STRIPE_WEBHOOK_SECRET) {
      app.log.error('STRIPE_WEBHOOK_SECRET not configured');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Webhook processing not configured',
        statusCode: 500,
      });
    }

    const event = request.body as StripeEvent;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription['customer'] as string;
        const status = subscription['status'] as string;

        // Map Stripe status to our plan
        const family = await prisma.family.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (family) {
          const plan =
            status === 'active' || status === 'trialing'
              ? 'FAMILY'
              : 'FREE';

          await prisma.family.update({
            where: { id: family.id },
            data: { plan },
          });

          app.log.info(
            { familyId: family.id, plan },
            'Updated family plan from Stripe webhook',
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription['customer'] as string;

        const family = await prisma.family.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (family) {
          await prisma.family.update({
            where: { id: family.id },
            data: { plan: 'FREE' },
          });

          app.log.info(
            { familyId: family.id },
            'Downgraded family to FREE after subscription cancellation',
          );
        }
        break;
      }

      default:
        app.log.info({ type: event.type }, 'Unhandled Stripe event type');
    }

    return reply.status(200).send({ received: true });
  });
}

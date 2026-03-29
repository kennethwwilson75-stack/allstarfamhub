import { config } from 'dotenv';
config({ path: '../../.env' });

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

// Route plugins
import authRoutes from './routes/auth.js';
import familyRoutes from './routes/families.js';
import eventRoutes from './routes/events.js';
import integrationRoutes from './routes/integrations.js';
import alertRoutes from './routes/alerts.js';
import webhookRoutes from './routes/webhooks.js';

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = '0.0.0.0';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const WEB_URL = process.env['WEB_URL'] ?? 'http://localhost:3000';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? (NODE_ENV === 'production' ? 'info' : 'debug'),
      ...(NODE_ENV !== 'production' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
  });

  // ─── CORS ──────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: NODE_ENV === 'production' ? [WEB_URL] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Rate Limiting ─────────────────────────────────────────────────
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // More generous limits for webhook endpoints
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for'] as string ?? request.ip;
    },
  });

  // ─── Security Headers ──────────────────────────────────────────────
  app.addHook('onSend', async (_request, reply) => {
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('X-XSS-Protection', '1; mode=block');
    void reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    void reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    void reply.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  // ─── Health Check ──────────────────────────────────────────────────
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      env: NODE_ENV,
    };
  });

  // ─── Register Route Plugins ────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/' });
  await app.register(familyRoutes, { prefix: '/' });
  await app.register(eventRoutes, { prefix: '/' });
  await app.register(integrationRoutes, { prefix: '/' });
  await app.register(alertRoutes, { prefix: '/' });
  await app.register(webhookRoutes, { prefix: '/' });

  // ─── Global Error Handler ──────────────────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    void reply.status(statusCode).send({
      error: error.name ?? 'Internal Server Error',
      message:
        statusCode === 500 && NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      statusCode,
    });
  });

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { buildServer };

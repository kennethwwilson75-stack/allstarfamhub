import { config } from 'dotenv';
config({ path: '../../../.env' });

import type { FastifyInstance } from 'fastify';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from '@allstarfamhub/shared';
import { prisma, type TransactionClient } from '../lib/prisma.js';
import { authenticate } from '../lib/auth.js';

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'];

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is not set');

interface SupabaseAuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
  };
  error?: { message: string };
}

interface SupabaseErrorResponse {
  error: string;
  error_description?: string;
  msg?: string;
}

async function supabaseAuthRequest(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<SupabaseAuthResponse> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json()) as SupabaseErrorResponse;
    throw new Error(err.error_description ?? err.msg ?? err.error ?? 'Auth failed');
  }

  return (await res.json()) as SupabaseAuthResponse;
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/register
   * Create Supabase user, then create local User + Family + FamilyMember.
   */
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const { email, password, familyName, displayName, timezone } = parsed.data;

    // 1. Register with Supabase
    let supabaseResult: SupabaseAuthResponse;
    try {
      supabaseResult = await supabaseAuthRequest('signup', { email, password });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return reply.status(400).send({
        error: 'Registration Error',
        message,
        statusCode: 400,
      });
    }

    // 2. Create local records in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email,
          supabaseId: supabaseResult.user.id,
          displayName,
        },
      });

      const family = await tx.family.create({
        data: {
          name: familyName,
          timezone: timezone ?? 'America/New_York',
        },
      });

      const member = await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          role: 'ADMIN',
          displayName,
        },
      });

      return { user, family, member };
    });

    return reply.status(201).send({
      data: {
        accessToken: supabaseResult.access_token,
        refreshToken: supabaseResult.refresh_token,
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          familyId: result.family.id,
          role: result.member.role,
        },
      },
    });
  });

  /**
   * GET /auth/me - Get current user's profile from token
   */
  app.get(
    '/auth/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.auth.userId },
        include: {
          members: {
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!user || !user.members[0]) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404,
        });
      }

      const member = user.members[0];
      return reply.send({
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          familyId: member.familyId,
          role: member.role,
        },
      });
    },
  );

  /**
   * POST /auth/login
   */
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;

    let supabaseResult: SupabaseAuthResponse;
    try {
      supabaseResult = await supabaseAuthRequest(
        'token?grant_type=password',
        { email, password },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return reply.status(401).send({
        error: 'Authentication Error',
        message,
        statusCode: 401,
      });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseResult.user.id },
      include: {
        members: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !user.members[0]) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User profile not found',
        statusCode: 404,
      });
    }

    const member = user.members[0];

    return reply.send({
      data: {
        accessToken: supabaseResult.access_token,
        refreshToken: supabaseResult.refresh_token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          familyId: member.familyId,
          role: member.role,
        },
      },
    });
  });

  /**
   * POST /auth/logout
   */
  app.post(
    '/auth/logout',
    { preHandler: [authenticate] },
    async (request, reply) => {
      // Supabase handles session invalidation via the JWT expiry.
      // We call their logout endpoint to invalidate the refresh token.
      const header = request.headers.authorization ?? '';
      const token = header.slice(7);

      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });
      } catch {
        // Best-effort logout
      }

      return reply.status(204).send();
    },
  );

  /**
   * POST /auth/refresh
   */
  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        statusCode: 400,
        details: parsed.error.flatten(),
      });
    }

    const { refreshToken } = parsed.data;

    let supabaseResult: SupabaseAuthResponse;
    try {
      supabaseResult = await supabaseAuthRequest(
        'token?grant_type=refresh_token',
        { refresh_token: refreshToken },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token refresh failed';
      return reply.status(401).send({
        error: 'Authentication Error',
        message,
        statusCode: 401,
      });
    }

    return reply.send({
      data: {
        accessToken: supabaseResult.access_token,
        refreshToken: supabaseResult.refresh_token,
      },
    });
  });
}

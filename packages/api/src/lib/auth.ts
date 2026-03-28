import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export interface AuthPayload {
  userId: string;
  familyId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthPayload;
  }
}

const JWT_SECRET = process.env['SUPABASE_JWT_SECRET'] ?? '';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Auth middleware: verifies Supabase JWT and attaches user context to request.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      statusCode: 401,
    });
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as SupabaseJwtPayload;

    const supabaseId = decoded.sub;
    if (!supabaseId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token: missing subject',
        statusCode: 401,
      });
    }

    // Look up the user and their primary family membership
    const user = await prisma.user.findUnique({
      where: { supabaseId },
      include: {
        members: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
        statusCode: 401,
      });
    }

    const member = user.members[0];
    if (!member) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'User has no family membership',
        statusCode: 403,
      });
    }

    request.auth = {
      userId: user.id,
      familyId: member.familyId,
      role: member.role,
    };
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Token expired'
        : 'Invalid token';
    return reply.status(401).send({
      error: 'Unauthorized',
      message,
      statusCode: 401,
    });
  }
}

/**
 * Guard: require ADMIN or PARENT role.
 */
export async function requireParentOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.auth.role !== 'ADMIN' && request.auth.role !== 'PARENT') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Requires ADMIN or PARENT role',
      statusCode: 403,
    });
  }
}

/**
 * Guard: require ADMIN role.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.auth.role !== 'ADMIN') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Requires ADMIN role',
      statusCode: 403,
    });
  }
}

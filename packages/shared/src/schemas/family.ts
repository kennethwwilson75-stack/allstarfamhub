import { z } from 'zod';

export const createFamilySchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().default('America/New_York'),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
});

export const addMemberSchema = z.object({
  displayName: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'PARENT', 'CHILD']),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  grade: z.string().max(10).optional(),
  schoolName: z.string().max(200).optional(),
});

export const updateMemberSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'PARENT', 'CHILD']).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  grade: z.string().max(10).optional(),
  schoolName: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'PARENT', 'CHILD']),
});

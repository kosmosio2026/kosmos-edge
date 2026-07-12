import { z } from "zod";

export const cuidSchema = z.string().min(10).max(50);

export const ipSchema = z.string().max(100).optional();

export const userAgentSchema = z.string().max(500).optional();

export const roleCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9_]+$/);

export const permissionKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(\.[a-z0-9_]+)+$/);

export const apiKeyCreateSchema = z.object({
  ownerType: z.string().trim().min(2).max(50),
  ownerId: z.string().trim().min(1).max(100),
  name: z.string().trim().max(100).optional(),
  scopes: z.array(z.string().trim().min(1).max(120)).default([]),
  expiresAt: z.string().datetime().optional(),
});

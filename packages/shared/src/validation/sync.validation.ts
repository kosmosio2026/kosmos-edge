import { z } from "zod";

export const syncDirectionSchema = z.enum([
  "EDGE_TO_CLOUD",
  "CLOUD_TO_EDGE",
]);

export const syncEnvelopeSchema = z.object({
  messageId: z.string().uuid(),
  schemaVersion: z.number().int().positive().default(1),
  direction: syncDirectionSchema,

  edgeNodeId: z.string().min(1).max(100).optional(),
  tenantId: z.string().min(1).max(100).optional(),
  parkingLotId: z.string().min(1).max(100).optional(),

  eventType: z.string().min(3).max(150),
  eventVersion: z.number().int().positive().default(1),

  aggregateType: z.string().min(1).max(100).optional(),
  aggregateId: z.string().min(1).max(100).optional(),

  sequence: z.number().int().nonnegative().optional(),

  occurredAt: z.string().datetime(),
  sentAt: z.string().datetime().optional(),

  payload: z.record(z.string(), z.any()),

  auth: z
    .object({
      keyId: z.string().min(1).max(100),
      signature: z.string().min(20).max(2000),
    })
    .optional(),
});

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;
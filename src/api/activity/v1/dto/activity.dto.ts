import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ActivityAction,
  ActivityActionFilter,
  ActivityEntityType,
  ActivityModule,
} from '@activity/domain/enum';

export const ActivityListQuerySchema = z.object({
  action: z.enum(ActivityActionFilter).optional(),
  actorId: z.uuid().optional(),
  cursor: z.string().min(1).max(200).optional(),
  from: z.iso.datetime().optional(),
  module: z.enum(ActivityModule),
  ownerId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  to: z.iso.datetime().optional(),
});
export const ActivityItemsQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  q: z.string().trim().max(100).optional(),
});
export const ActivityIdParamSchema = z.object({ id: z.uuid() });

const SummarySchema = z.object({
  amountCents: z.number().optional(),
  bookingDate: z.string().optional(),
  currency: z.string().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
  label: z.string(),
  sources: z.array(z.string()).optional(),
});
const ChangeSchema = z.object({ field: z.string(), from: z.unknown(), to: z.unknown() });

const ActivityEntryApiSchema = z.object({
  action: z.enum(ActivityAction),
  actor: z.object({ id: z.string().nullable(), name: z.string() }),
  batch: z.boolean(),
  batchPreview: z.object({ count: z.number(), labels: z.array(z.string()) }).nullable(),
  changes: z.array(ChangeSchema).nullable(),
  entityId: z.string().nullable(),
  entityType: z.enum(ActivityEntityType),
  id: z.string(),
  itemExists: z.boolean(),
  modules: z.array(z.enum(ActivityModule)),
  occurredAt: z.string(),
  owner: z.object({ id: z.string(), name: z.string(), type: z.enum(['FAMILY', 'USER']) }),
  summary: SummarySchema,
});
export const ActivityListApiSchema = z.object({
  items: z.array(ActivityEntryApiSchema),
  nextCursor: z.string().nullable(),
});

const BatchItemApiSchema = z.object({
  action: z.enum(ActivityAction),
  amountCents: z.number().nullable(),
  bookingDate: z.string().nullable(),
  currency: z.string().nullable(),
  entityId: z.string(),
  entityType: z.enum(ActivityEntityType),
  itemExists: z.boolean(),
  label: z.string(),
  sourceName: z.string().nullable(),
});
export const ActivityItemsApiSchema = z.object({
  header: z
    .object({
      bookingFrom: z.string().nullable(),
      bookingTo: z.string().nullable(),
      count: z.number(),
      existing: z.number(),
      sources: z.array(z.string()),
      totals: z.array(z.object({ amountCents: z.number(), currency: z.string() })),
    })
    .nullable(),
  items: z.array(BatchItemApiSchema),
  nextCursor: z.string().nullable(),
});

export class ActivityItemsOutput extends createZodDto(ActivityItemsApiSchema) {}
export class ActivityListOutput extends createZodDto(ActivityListApiSchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  NOTIFICATION_ITEM_STATES,
  NOTIFICATION_KINDS,
  NOTIFICATION_LOCALES,
  NOTIFICATION_MODULES,
  NOTIFICATION_TYPES,
} from '@notification/domain/enum';

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const TimeZoneSchema = z.string().min(1).max(64);
const LocaleSchema = z.enum(NOTIFICATION_LOCALES);
const LeadDaysSchema = z.number().int().min(0).max(30);

// Spec 124 section 7: `unread` arrives as a string.
export const NoticeListQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  module: z.enum(NOTIFICATION_MODULES).optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});
export const NoticeIdParamSchema = z.object({ id: z.uuid() });
export const ReadAllBodySchema = z.object({ before: z.iso.datetime().optional() });

const SnapshotApiSchema = z.object({
  accountName: z.string().optional(),
  cardName: z.string().optional(),
  currency: z.string().optional(),
  description: z.string(),
  location: z.string().optional(),
  ownerName: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  valueCents: z.number().int().optional(),
});
const NoticeItemApiSchema = z.object({
  dueDate: z.string(),
  route: z.string(),
  snapshot: SnapshotApiSchema,
  state: z.enum(NOTIFICATION_ITEM_STATES),
  type: z.enum(NOTIFICATION_TYPES),
});
const NoticeApiSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  items: z.array(NoticeItemApiSchema),
  kind: z.enum(NOTIFICATION_KINDS),
  localDate: z.string(),
  readAt: z.string().nullable(),
  title: z.string(),
});
export const NoticePageApiSchema = z.object({
  items: z.array(NoticeApiSchema),
  nextCursor: z.string().optional(),
});
export const UnreadCountApiSchema = z.object({ count: z.number().int() });
export const SummaryPreviewApiSchema = z.object({ count: z.number().int(), hasItems: z.boolean() });

const TypesApiSchema = z.object({
  FINANCE_BILL_DUE: z.boolean(),
  FINANCE_INVOICE_DUE: z.boolean(),
  STOCK_EXPIRING: z.boolean(),
  STOCK_OPENED_EXPIRING: z.boolean(),
});
export const PreferencesApiSchema = z.object({
  billLeadDays: z.number().int(),
  families: z.array(z.object({ enabled: z.boolean(), familyId: z.string(), name: z.string() })),
  invoiceLeadDays: z.number().int(),
  locale: LocaleSchema,
  quietEnd: TimeSchema,
  quietStart: TimeSchema,
  summaryTime: TimeSchema,
  tickMinutes: z.number().int(),
  timeZone: z.string(),
  types: TypesApiSchema,
});
export const UpdatePreferencesBodySchema = z
  .object({
    billLeadDays: LeadDaysSchema,
    families: z.array(z.object({ enabled: z.boolean(), familyId: z.uuid() })).max(100),
    invoiceLeadDays: LeadDaysSchema,
    locale: LocaleSchema,
    quietEnd: TimeSchema,
    quietStart: TimeSchema,
    summaryTime: TimeSchema,
    timeZone: TimeZoneSchema,
    types: TypesApiSchema.partial(),
  })
  .partial()
  .strict();

export class NoticePageOutput extends createZodDto(NoticePageApiSchema) {}
export class PreferencesOutput extends createZodDto(PreferencesApiSchema) {}
export class SummaryPreviewOutput extends createZodDto(SummaryPreviewApiSchema) {}
export class UnreadCountOutput extends createZodDto(UnreadCountApiSchema) {}

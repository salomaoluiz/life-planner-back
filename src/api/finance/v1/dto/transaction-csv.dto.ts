import { z } from 'zod';

import { CalendarDateApiSchema, OwnerIdApiSchema } from '@api/finance/v1/dto/finance-fields';
import { IdListQuerySchema, withPeriodRules } from '@api/finance/v1/finance-query';

// Spec 047 §7: `from`/`to` are required here (and at most 2 years apart, as in spec 045).
const ExportCountQueryFields = {
  accountId: IdListQuerySchema,
  creditCardId: IdListQuerySchema,
  from: CalendarDateApiSchema,
  owner: z.enum(['ALL', 'FAMILY', 'USER']).default('ALL'),
  ownerId: OwnerIdApiSchema.optional(),
  to: CalendarDateApiSchema,
  today: CalendarDateApiSchema.optional(),
};

export const ExportCountQuerySchema = withPeriodRules(z.object(ExportCountQueryFields)).refine(
  (value) => value.owner !== 'FAMILY' || value.ownerId !== undefined,
  { message: 'ownerId is required for a family' },
);

export const ExportQuerySchema = withPeriodRules(
  z.object({
    ...ExportCountQueryFields,
    format: z.enum(['BR', 'INTL']),
    lang: z.enum(['en-US', 'pt-BR']).default('en-US'),
  }),
).refine((value) => value.owner !== 'FAMILY' || value.ownerId !== undefined, {
  message: 'ownerId is required for a family',
});

export const ExportCountOutputSchema = z.object({ count: z.number().int().min(0) });

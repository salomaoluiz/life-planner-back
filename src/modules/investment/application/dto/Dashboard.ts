import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
} from '@investment/application/dto/InvestmentCommon';

const MAX_YEARS = 10;

// Spec 110: the owners to consolidate (each one must be readable), the period (up to 10 years, never in the future)
// and the client's local date.
export const GetInvestmentsDashboardSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    from: z.iso.date(),
    ownerIds: z.array(OwnerIdSchema).min(1),
    to: z.iso.date(),
    today: z.iso.date(),
  })
  .refine((input) => input.from <= input.to, { message: 'from must be on or before to' })
  .refine((input) => input.to <= input.today, { message: 'to cannot be in the future' })
  .refine((input) => input.to <= addYears(input.from, MAX_YEARS), {
    message: 'The period cannot exceed 10 years',
  });
export type GetInvestmentsDashboardInput = z.input<typeof GetInvestmentsDashboardSchema>;

function addYears(date: string, years: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);

  value.setUTCFullYear(value.getUTCFullYear() + years);

  return value.toISOString().slice(0, 10);
}

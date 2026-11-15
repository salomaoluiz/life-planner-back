import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  OwnerIdSchema,
} from '@investment/application/dto/InvestmentCommon';

const MAX_YEARS = 10;

// Spec 110 FR 3, 7: the period ends at most today and spans at most 10 years.
export const GetInvestmentsDashboardSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    from: CalendarDateSchema,
    ownerIds: z.array(OwnerIdSchema).min(1),
    to: CalendarDateSchema,
    today: CalendarDateSchema,
  })
  .refine((input) => input.from <= input.to, {
    message: 'The period ends before it starts',
    path: ['from'],
  })
  .refine((input) => input.to <= input.today, {
    message: 'No future periods in investments',
    path: ['to'],
  })
  .refine((input) => input.from >= addYears(input.to, -MAX_YEARS), {
    message: 'The period is longer than 10 years',
    path: ['from'],
  });
export type GetInvestmentsDashboardInput = z.input<typeof GetInvestmentsDashboardSchema>;

function addYears(date: string, years: number): string {
  const [year, month, day] = date.split('-');

  return `${String(Number(year) + years).padStart(4, '0')}-${month}-${day}`;
}

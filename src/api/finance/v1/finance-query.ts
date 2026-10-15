import { z } from 'zod';

import { CalendarDateApiSchema } from '@api/finance/v1/dto/finance-fields';

// `?ownerId=a` arrives as a string, `?ownerId=a&ownerId=b` as an array.
export const OwnerIdQuerySchema = z.union([z.uuid(), z.array(z.uuid())]).optional();

export function toOwnerIds(ownerId?: string | string[]): string[] | undefined {
  if (ownerId === undefined) {
    return undefined;
  }

  return Array.isArray(ownerId) ? ownerId : [ownerId];
}

// `?today=2026-10-15`: the client's local calendar date; invalid → 400 through `validate`.
export const TodayQuerySchema = z.object({ today: CalendarDateApiSchema.optional() });

// A missing `today` means the server's UTC date (spec 028 FR 6).
export function resolveToday(today?: string): string {
  return today ?? new Date().toISOString().slice(0, 10);
}

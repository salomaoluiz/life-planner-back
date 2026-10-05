import { z } from 'zod';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

export const MAX_QUANTITY = 1_000_000;

export const AccessibleOwnersSchema = z.array(
  z.object({ owner: z.enum(OwnerType), ownerId: z.string().min(1) }),
);
export const DescriptionSchema = z.string().trim().min(1).max(200);
export const OwnerIdSchema = z.string().min(1);
export const OwnerTypeSchema = z.enum(OwnerType);
export const QuantitySchema = z.number().int().min(0).max(MAX_QUANTITY);
export const UnitSchema = z.enum(StockUnits);

// ISO 8601 date-time -> Date. Year 0000 does not exist in Postgres (it would surface as a 500).
export const DateTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((date) => date.getUTCFullYear() >= 1, { message: 'Invalid date' });

function blankToNull(value: null | string | undefined) {
  return value === '' ? null : value;
}
function blankToUndefined(value: null | string | undefined) {
  return value === '' || value === null ? undefined : value;
}

// Create: absent, null and '' all mean "no value".
export const OptionalBarcodeSchema = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform(blankToUndefined);
export const OptionalBrandSchema = z.string().trim().max(100).nullish().transform(blankToUndefined);
export const OptionalDateTimeSchema = DateTimeSchema.nullish().transform(
  (value) => value ?? undefined,
);
export const OptionalNotesSchema = z.string().max(1000).nullish().transform(blankToUndefined);

// Update: undefined = unchanged, null and '' = clear.
export const NullableBarcodeSchema = z
  .string()
  .trim()
  .max(64)
  .nullable()
  .optional()
  .transform(blankToNull);
export const NullableBrandSchema = z
  .string()
  .trim()
  .max(100)
  .nullable()
  .optional()
  .transform(blankToNull);
export const NullableDateTimeSchema = DateTimeSchema.nullable().optional();
export const NullableNotesSchema = z
  .string()
  .max(1000)
  .nullable()
  .optional()
  .transform(blankToNull);

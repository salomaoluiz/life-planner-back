import { z } from 'zod';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { MAX_QUANTITY } from '@stock/domain/service/StockQuantity';

export { MAX_QUANTITY };

export const AccessibleOwnersSchema = z.array(
  z.object({
    archived: z.boolean().optional(),
    owner: z.enum(OwnerType),
    ownerId: z.string().min(1),
  }),
);
export const DescriptionSchema = z.string().trim().min(1).max(100);
export const OwnerIdSchema = z.string().min(1);
export const OwnerTypeSchema = z.enum(OwnerType);
// Non-negative; the per-unit precision (whole units, 3 decimals) is a 422 checked by the use cases.
export const QuantitySchema = z.number().min(0).max(MAX_QUANTITY);
export const PositiveQuantitySchema = z.number().gt(0).max(MAX_QUANTITY);
export const StepSchema = z.number().gt(0).max(MAX_QUANTITY);
export const UnitSchema = z.enum(StockUnits);
export const WarnDaysSchema = z.number().int().min(0).max(365);
export const OpenedShelfLifeDaysSchema = z.number().int().min(1).max(3650);
export const CatalogNameSchema = z.string().trim().min(1).max(50);

// `YYYY-MM-DD` -> Date at UTC midnight. Year 0000 does not exist in Postgres (it would surface as a 500).
export const DaySchema = z.iso
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
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
export const OptionalDaySchema = DaySchema.nullish().transform((value) => value ?? undefined);
export const OptionalIdSchema = z.string().min(1).nullish().transform(blankToUndefined);
export const OptionalNotesSchema = z.string().max(1000).nullish().transform(blankToUndefined);
export const OptionalNumberSchema = z
  .number()
  .nullish()
  .transform((value) => value ?? undefined);
export const OptionalTodaySchema = DaySchema.optional();

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
export const NullableIdSchema = z.string().min(1).nullable().optional();
export const NullableNotesSchema = z
  .string()
  .max(1000)
  .nullable()
  .optional()
  .transform(blankToNull);
export const NullableQuantitySchema = QuantitySchema.nullable().optional();
export const NullableStepSchema = StepSchema.nullable().optional();
export const NullableShelfLifeSchema = OpenedShelfLifeDaysSchema.nullable().optional();

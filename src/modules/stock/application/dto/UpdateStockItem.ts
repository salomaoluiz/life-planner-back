import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  DescriptionSchema,
  NullableBarcodeSchema,
  NullableBrandSchema,
  NullableIdSchema,
  NullableNotesSchema,
  NullableQuantitySchema,
  NullableShelfLifeSchema,
  NullableStepSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  UnitSchema,
  WarnDaysSchema,
} from '@stock/application/dto/StockCommon';

const EDITABLE_FIELDS = [
  'barcode',
  'brand',
  'categoryId',
  'description',
  'idealQuantity',
  'locationId',
  'minQuantity',
  'notes',
  'openedShelfLifeDays',
  'owner',
  'ownerId',
  'quickStep',
  'stockOnly',
  'unit',
  'warnDaysClosed',
  'warnDaysOpened',
] as const;

export const UpdateStockItemSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    barcode: NullableBarcodeSchema,
    brand: NullableBrandSchema,
    categoryId: NullableIdSchema,
    description: DescriptionSchema.optional(),
    id: z.string().min(1),
    idealQuantity: NullableQuantitySchema,
    locationId: NullableIdSchema,
    minQuantity: NullableQuantitySchema,
    notes: NullableNotesSchema,
    openedShelfLifeDays: NullableShelfLifeSchema,
    owner: OwnerTypeSchema.optional(),
    ownerId: OwnerIdSchema.optional(),
    quickStep: NullableStepSchema,
    stockOnly: z.boolean().optional(),
    unit: UnitSchema.optional(),
    warnDaysClosed: WarnDaysSchema.optional(),
    warnDaysOpened: WarnDaysSchema.optional(),
  })
  .refine((input) => EDITABLE_FIELDS.some((field) => input[field] !== undefined), {
    message: 'At least one field is required',
  })
  .refine((input) => (input.owner === undefined) === (input.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

export type UpdateStockItemInput = z.input<typeof UpdateStockItemSchema>;

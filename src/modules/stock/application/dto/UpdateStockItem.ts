import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  DescriptionSchema,
  NullableBarcodeSchema,
  NullableBrandSchema,
  NullableDateTimeSchema,
  NullableNotesSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  QuantitySchema,
  UnitSchema,
} from '@stock/application/dto/StockCommon';

const EDITABLE_FIELDS = [
  'barcode',
  'brand',
  'description',
  'expirationDate',
  'notes',
  'openingDate',
  'owner',
  'ownerId',
  'purchaseDate',
  'quantity',
  'unit',
] as const;

export const UpdateStockItemSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    barcode: NullableBarcodeSchema,
    brand: NullableBrandSchema,
    description: DescriptionSchema.optional(),
    expirationDate: NullableDateTimeSchema,
    id: z.string().min(1),
    notes: NullableNotesSchema,
    openingDate: NullableDateTimeSchema,
    owner: OwnerTypeSchema.optional(),
    ownerId: OwnerIdSchema.optional(),
    purchaseDate: NullableDateTimeSchema,
    quantity: QuantitySchema.optional(),
    unit: UnitSchema.optional(),
  })
  .refine((input) => EDITABLE_FIELDS.some((field) => input[field] !== undefined), {
    message: 'At least one field is required',
  })
  .refine((input) => (input.owner === undefined) === (input.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

export type UpdateStockItemInput = z.input<typeof UpdateStockItemSchema>;

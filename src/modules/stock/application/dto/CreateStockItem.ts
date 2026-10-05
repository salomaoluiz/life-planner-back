import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  DescriptionSchema,
  OptionalBarcodeSchema,
  OptionalBrandSchema,
  OptionalDateTimeSchema,
  OptionalNotesSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  QuantitySchema,
  UnitSchema,
} from '@stock/application/dto/StockCommon';

export const CreateStockItemSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  barcode: OptionalBarcodeSchema,
  brand: OptionalBrandSchema,
  description: DescriptionSchema,
  expirationDate: OptionalDateTimeSchema,
  notes: OptionalNotesSchema,
  openingDate: OptionalDateTimeSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  purchaseDate: OptionalDateTimeSchema,
  quantity: QuantitySchema,
  unit: UnitSchema,
});

export type CreateStockItemInput = z.input<typeof CreateStockItemSchema>;

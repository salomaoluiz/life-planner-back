import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  DescriptionSchema,
  OpenedShelfLifeDaysSchema,
  OptionalBarcodeSchema,
  OptionalBrandSchema,
  OptionalDaySchema,
  OptionalIdSchema,
  OptionalNotesSchema,
  OptionalTodaySchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  QuantitySchema,
  StepSchema,
  UnitSchema,
  WarnDaysSchema,
} from '@stock/application/dto/StockCommon';

const OptionalQuantitySchema = QuantitySchema.nullish().transform((value) => value ?? undefined);
const OptionalShelfLifeSchema = OpenedShelfLifeDaysSchema.nullish().transform(
  (value) => value ?? undefined,
);

const OptionalPriceSchema = z
  .number()
  .int()
  .min(1)
  .max(99_999_999)
  .nullish()
  .transform((value) => value ?? undefined);
const OptionalStepSchema = StepSchema.nullish().transform((value) => value ?? undefined);

export const CreateStockItemSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  barcode: OptionalBarcodeSchema,
  brand: OptionalBrandSchema,
  categoryId: OptionalIdSchema,
  description: DescriptionSchema,
  estimatedUnitPriceCents: OptionalPriceSchema,
  expirationDate: OptionalDaySchema,
  idealQuantity: OptionalQuantitySchema,
  locationId: OptionalIdSchema,
  minQuantity: OptionalQuantitySchema,
  notes: OptionalNotesSchema,
  openedShelfLifeDays: OptionalShelfLifeSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  purchaseDate: OptionalDaySchema,
  quantity: QuantitySchema.default(0),
  quickStep: OptionalStepSchema,
  shoppingListId: OptionalIdSchema,
  stockOnly: z.boolean().default(false),
  today: OptionalTodaySchema,
  unit: UnitSchema,
  userId: z.string().min(1),
  warnDaysClosed: WarnDaysSchema.default(7),
  warnDaysOpened: WarnDaysSchema.default(1),
});

export type CreateStockItemInput = z.input<typeof CreateStockItemSchema>;

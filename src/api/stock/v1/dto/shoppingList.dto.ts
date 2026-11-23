import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  MAX_ESTIMATED_PRICE_CENTS,
  SHOPPING_LIST_CURRENCIES,
} from '@stock/application/dto/ShoppingList';
import {
  CatalogNameSchema,
  DescriptionSchema,
  PositiveQuantitySchema,
} from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

const OwnerTypeApiSchema = z.enum(OwnerType);
const CurrencyApiSchema = z.enum(SHOPPING_LIST_CURRENCIES);
const PriceApiSchema = z.number().int().min(1).max(MAX_ESTIMATED_PRICE_CENTS);
const UnitApiSchema = z.enum(StockUnits);
const OriginApiSchema = z.enum(['AUTO', 'AUTO_EDITED', 'MANUAL']);
const PriceSourceSchema = z.enum([
  'HISTORY_ANY_MARKET',
  'HISTORY_DEFAULT_MARKET',
  'MANUAL',
  'NONE',
]);

export const ShoppingListsQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  owner: OwnerTypeApiSchema.optional(),
  ownerId: z.uuid().optional(),
});
export const CreateShoppingListApiSchema = z
  .object({
    currency: CurrencyApiSchema.optional(),
    isDefault: z.boolean().optional(),
    name: CatalogNameSchema,
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
  })
  .strict();
// `owner`/`ownerId` are not accepted: the owner of a list never changes (400).
export const UpdateShoppingListApiSchema = z
  .object({
    currency: CurrencyApiSchema,
    defaultFinanceCategoryId: z.uuid().nullable(),
    defaultMarketId: z.uuid().nullable(),
    isDefault: z.boolean(),
    name: CatalogNameSchema,
    status: z.enum(StockCatalogStatus),
  })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });
export const AddShoppingListRowApiSchema = z
  .object({
    description: DescriptionSchema.optional(),
    estimatedUnitPriceCents: PriceApiSchema.optional(),
    itemId: z.uuid().optional(),
    origin: OriginApiSchema.optional(),
    quantity: PositiveQuantitySchema,
    restore: z.boolean().optional(),
    unit: UnitApiSchema.optional(),
  })
  .strict();
export const UpdateShoppingListRowApiSchema = z
  .object({
    description: DescriptionSchema,
    estimatedUnitPriceCents: PriceApiSchema.nullable(),
    quantity: PositiveQuantitySchema,
    unit: UnitApiSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

const ListSchema = z.object({
  currency: CurrencyApiSchema,
  defaultFinanceCategoryId: z.uuid().nullable(),
  defaultMarketId: z.uuid().nullable(),
  id: z.uuid(),
  isDefault: z.boolean(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  status: z.enum(StockCatalogStatus),
});
const CardSchema = ListSchema.extend({
  autoCount: z.number().int(),
  estimatedTotalCents: z.number().int(),
  pricedCount: z.number().int(),
  rowCount: z.number().int(),
});
const RowSchema = z.object({
  description: z.string(),
  estimateCents: z.number().int().nullable(),
  id: z.uuid(),
  itemId: z.uuid().nullable(),
  origin: OriginApiSchema,
  priceSource: PriceSourceSchema,
  quantity: z.number(),
  stock: z
    .object({
      categoryPath: z.string().nullable(),
      idealQuantity: z.number().nullable(),
      minQuantity: z.number().nullable(),
      quantity: z.number(),
    })
    .nullable(),
  unit: UnitApiSchema,
  unitPriceCents: z.number().int().nullable(),
});
const TotalsSchema = z.object({
  autoCount: z.number().int(),
  estimatedTotalCents: z.number().int(),
  pricedCount: z.number().int(),
  rowCount: z.number().int(),
});
export const ShoppingListsApiSchema = z.object({ items: z.array(CardSchema) });
export const ShoppingListDetailApiSchema = z.object({
  groups: z.array(
    z.object({
      category: z.object({ id: z.uuid(), name: z.string(), path: z.string() }).nullable(),
      rows: z.array(RowSchema),
      subtotalCents: z.number().int(),
      unpricedCount: z.number().int(),
    }),
  ),
  list: ListSchema,
  totals: TotalsSchema,
});
export const ShoppingListRowResultApiSchema = z.object({ merged: z.boolean(), row: RowSchema });
export const RestockSummaryApiSchema = z.object({
  count: z.number().int(),
  groups: z.array(
    z.object({
      list: z.object({
        id: z.uuid(),
        name: z.string(),
        owner: OwnerTypeApiSchema,
        ownerName: z.string().nullable(),
      }),
      rows: z.array(
        z.object({ description: z.string(), quantity: z.number(), unit: UnitApiSchema }),
      ),
    }),
  ),
  totals: z.array(
    z.object({
      currency: z.string(),
      estimatedTotalCents: z.number().int(),
      pricedCount: z.number().int(),
    }),
  ),
});

export type AddShoppingListRowApiInput = z.infer<typeof AddShoppingListRowApiSchema>;
export type CreateShoppingListApiInput = z.infer<typeof CreateShoppingListApiSchema>;
export type UpdateShoppingListApiInput = z.infer<typeof UpdateShoppingListApiSchema>;
export type UpdateShoppingListRowApiInput = z.infer<typeof UpdateShoppingListRowApiSchema>;

export class AddShoppingListRowBody extends createZodDto(AddShoppingListRowApiSchema) {}
export class CreateShoppingListBody extends createZodDto(CreateShoppingListApiSchema) {}
export class RestockSummaryOutput extends createZodDto(RestockSummaryApiSchema) {}
export class ShoppingListDetailOutput extends createZodDto(ShoppingListDetailApiSchema) {}
export class ShoppingListOutput extends createZodDto(ListSchema) {}
export class ShoppingListRowOutput extends createZodDto(RowSchema) {}
export class ShoppingListRowResultOutput extends createZodDto(ShoppingListRowResultApiSchema) {}
export class ShoppingListsOutput extends createZodDto(ShoppingListsApiSchema) {}
export class UpdateShoppingListBody extends createZodDto(UpdateShoppingListApiSchema) {}
export class UpdateShoppingListRowBody extends createZodDto(UpdateShoppingListRowApiSchema) {}

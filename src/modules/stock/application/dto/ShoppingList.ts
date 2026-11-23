import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CatalogNameSchema,
  DescriptionSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  PositiveQuantitySchema,
  UnitSchema,
} from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

// Spec 118 FR 22: a unit price in minor units.
export const MAX_ESTIMATED_PRICE_CENTS = 99_999_999;
export const SHOPPING_LIST_CURRENCIES = ['BRL', 'USD', 'EUR'] as const;
export const LanguageSchema = z.enum(['en-US', 'pt-BR']).optional();

const CurrencySchema = z.enum(SHOPPING_LIST_CURRENCIES);
const PriceSchema = z.number().int().min(1).max(MAX_ESTIMATED_PRICE_CENTS);

export const GetShoppingListsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  includeArchived: z.boolean().default(false),
  language: LanguageSchema,
  ownerId: OwnerIdSchema.optional(),
});
export const GetShoppingListByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});
export const CreateShoppingListSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  currency: CurrencySchema.default('BRL'),
  isDefault: z.boolean().default(false),
  language: LanguageSchema,
  name: CatalogNameSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});
export const UpdateShoppingListSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    currency: CurrencySchema.optional(),
    defaultFinanceCategoryId: z.string().min(1).nullable().optional(),
    defaultMarketId: z.string().min(1).nullable().optional(),
    id: z.string().min(1),
    isDefault: z.boolean().optional(),
    name: CatalogNameSchema.optional(),
    status: z.enum(StockCatalogStatus).optional(),
  })
  .refine(
    (input) =>
      input.currency !== undefined ||
      input.defaultFinanceCategoryId !== undefined ||
      input.defaultMarketId !== undefined ||
      input.isDefault !== undefined ||
      input.name !== undefined ||
      input.status !== undefined,
    { message: 'At least one field is required' },
  );
// An item row (`itemId`) or a text row (`description` + `unit`); `origin` only with `restore` (FR 18).
export const AddShoppingListRowSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    description: DescriptionSchema.optional(),
    estimatedUnitPriceCents: PriceSchema.optional(),
    itemId: z.string().min(1).optional(),
    listId: z.string().min(1),
    origin: z.enum(['AUTO', 'AUTO_EDITED', 'MANUAL']).optional(),
    quantity: PositiveQuantitySchema,
    restore: z.boolean().optional(),
    unit: UnitSchema.optional(),
    userId: z.string().min(1),
  })
  .refine(
    (input) =>
      input.itemId !== undefined
        ? input.description === undefined && input.unit === undefined
        : input.description !== undefined && input.unit !== undefined,
    { message: 'Send an itemId, or a description and a unit' },
  )
  .refine((input) => input.origin === undefined || (input.restore && input.itemId !== undefined), {
    message: 'origin only applies to a restore of an item row',
  });
export const UpdateShoppingListRowSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    description: DescriptionSchema.optional(),
    estimatedUnitPriceCents: PriceSchema.nullable().optional(),
    id: z.string().min(1),
    quantity: PositiveQuantitySchema.optional(),
    unit: UnitSchema.optional(),
  })
  .refine(
    (input) =>
      input.description !== undefined ||
      input.estimatedUnitPriceCents !== undefined ||
      input.quantity !== undefined ||
      input.unit !== undefined,
    { message: 'At least one field is required' },
  );
export const DeleteShoppingListRowSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  userId: z.string().min(1),
});
export const GetRestockSummarySchema = z.object({ accessibleOwners: AccessibleOwnersSchema });

export type AddShoppingListRowInput = z.input<typeof AddShoppingListRowSchema>;
export type CreateShoppingListInput = z.input<typeof CreateShoppingListSchema>;
export type DeleteShoppingListRowInput = z.input<typeof DeleteShoppingListRowSchema>;
export type GetRestockSummaryInput = z.input<typeof GetRestockSummarySchema>;
export type GetShoppingListByIdInput = z.input<typeof GetShoppingListByIdSchema>;
export type GetShoppingListsInput = z.input<typeof GetShoppingListsSchema>;
export type UpdateShoppingListInput = z.input<typeof UpdateShoppingListSchema>;
export type UpdateShoppingListRowInput = z.input<typeof UpdateShoppingListRowSchema>;

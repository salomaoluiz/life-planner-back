import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CatalogNameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

// What the API tells about the finance categories the owner can use; the rules on them live in the use cases.
export const FinanceCategoryRefsSchema = z
  .array(z.object({ archived: z.boolean(), id: z.string().min(1), isExpense: z.boolean() }))
  .optional();
const OwnerFields = {
  accessibleOwners: AccessibleOwnersSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
};
const LanguageSchema = z.enum(['en-US', 'pt-BR']);
const StatusSchema = z.enum(StockCatalogStatus);
const NullableId = z.string().min(1).nullable().optional();

export const GetStockCatalogSchema = z.object({
  ...OwnerFields,
  includeArchived: z.boolean().default(false),
});
export const CreateStockCategorySchema = z.object({
  ...OwnerFields,
  financeCategories: FinanceCategoryRefsSchema,
  financeCategoryId: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value ?? undefined),
  name: CatalogNameSchema,
  parentId: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value ?? undefined),
});
export const CreateStockLocationSchema = z.object({ ...OwnerFields, name: CatalogNameSchema });
export const UpdateStockCategorySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    financeCategories: FinanceCategoryRefsSchema,
    financeCategoryId: NullableId,
    id: z.string().min(1),
    name: CatalogNameSchema.optional(),
    parentId: NullableId,
    status: StatusSchema.optional(),
  })
  .refine(
    (input) =>
      input.financeCategoryId !== undefined ||
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.status !== undefined,
    { message: 'At least one field is required' },
  );
export const UpdateStockLocationSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    id: z.string().min(1),
    name: CatalogNameSchema.optional(),
    status: StatusSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.status !== undefined, {
    message: 'At least one field is required',
  });
export const DeleteStockCatalogSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});
export const CreateStockSuggestionsSchema = z.object({ ...OwnerFields, language: LanguageSchema });

export type CreateStockCategoryInput = z.input<typeof CreateStockCategorySchema>;
export type CreateStockLocationInput = z.input<typeof CreateStockLocationSchema>;
export type CreateStockSuggestionsInput = z.input<typeof CreateStockSuggestionsSchema>;
export type DeleteStockCatalogInput = z.input<typeof DeleteStockCatalogSchema>;
export type GetStockCatalogInput = z.input<typeof GetStockCatalogSchema>;
export type UpdateStockCategoryInput = z.input<typeof UpdateStockCategorySchema>;
export type UpdateStockLocationInput = z.input<typeof UpdateStockLocationSchema>;

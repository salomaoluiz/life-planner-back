import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CatalogNameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { isHexColor } from '@stock/domain/service/CatalogAppearance';

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
const OptionalId = z
  .string()
  .min(1)
  .nullish()
  .transform((value) => value ?? undefined);
// Spec 125 FR 10: `#RRGGBB` and a catalog icon name; `iconCatalog` is what the API tells about the names that exist.
const ColorSchema = z.string().refine(isHexColor, { message: 'Color must be #RRGGBB' });
const IconSchema = z.string().min(1).max(64);
const IconCatalogSchema = z.array(z.string()).optional();
const ChildColorsSchema = z.record(z.string().min(1), ColorSchema).optional();

// Spec 125 section 7: no owner = every owner the user can read ("Todos").
export const GetStockCatalogSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  includeArchived: z.boolean().default(false),
  owner: OwnerTypeSchema.optional(),
  ownerId: OwnerIdSchema.optional(),
});
export const CreateStockCategorySchema = z.object({
  ...OwnerFields,
  color: ColorSchema,
  financeCategories: FinanceCategoryRefsSchema,
  financeCategoryId: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value ?? undefined),
  icon: IconSchema,
  iconCatalog: IconCatalogSchema,
  name: CatalogNameSchema,
  parentId: OptionalId,
});
export const CreateStockLocationSchema = z.object({
  ...OwnerFields,
  color: ColorSchema,
  icon: IconSchema,
  iconCatalog: IconCatalogSchema,
  name: CatalogNameSchema,
  parentId: OptionalId,
});
export const UpdateStockCategorySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    applyToChildren: z.boolean().default(false),
    childColors: ChildColorsSchema,
    color: ColorSchema.optional(),
    financeCategories: FinanceCategoryRefsSchema,
    financeCategoryId: NullableId,
    icon: IconSchema.optional(),
    iconCatalog: IconCatalogSchema,
    id: z.string().min(1),
    name: CatalogNameSchema.optional(),
    parentId: NullableId,
    status: StatusSchema.optional(),
  })
  .refine(
    (input) =>
      input.color !== undefined ||
      input.financeCategoryId !== undefined ||
      input.icon !== undefined ||
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.status !== undefined,
    { message: 'At least one field is required' },
  );
export const UpdateStockLocationSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    applyToChildren: z.boolean().default(false),
    childColors: ChildColorsSchema,
    color: ColorSchema.optional(),
    icon: IconSchema.optional(),
    iconCatalog: IconCatalogSchema,
    id: z.string().min(1),
    name: CatalogNameSchema.optional(),
    parentId: NullableId,
    status: StatusSchema.optional(),
  })
  .refine(
    (input) =>
      input.color !== undefined ||
      input.icon !== undefined ||
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.status !== undefined,
    { message: 'At least one field is required' },
  );
// Spec 125 FR 21-23: `moveTo` is an id or `none`; undefined = no decision (409 when items use it).
export const DeleteStockCatalogSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  moveTo: z.string().min(1).optional(),
});
export const CreateStockSuggestionsSchema = z.object({
  ...OwnerFields,
  keys: z.array(z.string().min(1)).optional(),
  language: LanguageSchema,
});

export type CreateStockCategoryInput = z.input<typeof CreateStockCategorySchema>;
export type CreateStockLocationInput = z.input<typeof CreateStockLocationSchema>;
export type CreateStockSuggestionsInput = z.input<typeof CreateStockSuggestionsSchema>;
export type DeleteStockCatalogInput = z.input<typeof DeleteStockCatalogSchema>;
export type GetStockCatalogInput = z.input<typeof GetStockCatalogSchema>;
export type UpdateStockCategoryInput = z.input<typeof UpdateStockCategorySchema>;
export type UpdateStockLocationInput = z.input<typeof UpdateStockLocationSchema>;

export const GetStockLocationByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type GetStockLocationByIdInput = z.input<typeof GetStockLocationByIdSchema>;

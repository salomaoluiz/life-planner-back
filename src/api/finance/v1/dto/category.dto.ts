import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  hasAtLeastOneField,
  IconApiSchema,
  IconColorApiSchema,
  NameApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TransactionTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { AccountStatus } from '@finance/domain/enum';

export const CATEGORY_SCOPES = ['PERSONAL', 'FAMILY', 'ALL'] as const;

// `owner: ALL` (spec 038): the creator's Personal scope plus every family they are in; `ownerId` is then omitted.
export const CreateCategoryApiSchema = z
  .object({
    icon: IconApiSchema,
    iconColor: IconColorApiSchema.default('#000000'),
    name: NameApiSchema,
    owner: OwnerTypeApiSchema.or(z.literal('ALL')),
    ownerId: OwnerIdApiSchema.optional(),
    parentId: z.uuid().optional(),
    type: TransactionTypeApiSchema,
  })
  .refine((input) => (input.owner === 'ALL') === (input.ownerId === undefined), {
    message: 'ownerId is required, except for owner ALL where it must be omitted',
  });

const UpdateCategoryFields = z
  .object({
    icon: IconApiSchema,
    iconColor: IconColorApiSchema,
    name: NameApiSchema,
    parentId: z.uuid().nullable(),
    // Turns a single-scope main category into an All category; there is no way back.
    scope: z.literal('ALL'),
    // Archives / reactivates the category with its whole subtree (spec 041).
    status: z.enum(AccountStatus),
    type: TransactionTypeApiSchema,
  })
  .partial();

export const UpdateCategoryApiSchema = UpdateCategoryFields.strict().refine(hasAtLeastOneField, {
  message: 'At least one field is required',
});

// Spec 058: the PATCH fields plus the icon / color of the descendants, applied in one transaction.
export const UpdateCategoryAppearanceApiSchema = UpdateCategoryFields.extend({
  descendants: z
    .array(
      z
        .object({
          icon: IconApiSchema.optional(),
          iconColor: IconColorApiSchema.optional(),
          id: z.uuid(),
        })
        .strict()
        .refine((item) => item.icon !== undefined || item.iconColor !== undefined, {
          message: 'icon or iconColor is required',
        }),
    )
    .min(1)
    .max(500),
}).strict();

export const CategoryApiSchema = z.object({
  createdAt: z.iso.datetime(),
  depthLevel: z.number().int(),
  icon: z.string(),
  iconColor: z.string(),
  id: z.uuid(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  parentId: z.uuid().nullable(),
  scope: z.enum(CATEGORY_SCOPES),
  // The scopes the caller can access (for ALL, `owner/ownerId` is the first of them).
  scopes: z.array(z.object({ owner: OwnerTypeApiSchema, ownerId: z.uuid() })),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  type: TransactionTypeApiSchema,
  updatedAt: z.iso.datetime(),
});

export type CreateCategoryApiInput = z.infer<typeof CreateCategoryApiSchema>;
export type UpdateCategoryApiInput = z.infer<typeof UpdateCategoryApiSchema>;
export type UpdateCategoryAppearanceApiInput = z.infer<typeof UpdateCategoryAppearanceApiSchema>;

export class CategoryOutput extends createZodDto(CategoryApiSchema) {}
export class CreateCategoryBody extends createZodDto(CreateCategoryApiSchema) {}
export class UpdateCategoryAppearanceBody extends createZodDto(UpdateCategoryAppearanceApiSchema) {}
export class UpdateCategoryBody extends createZodDto(UpdateCategoryApiSchema) {}

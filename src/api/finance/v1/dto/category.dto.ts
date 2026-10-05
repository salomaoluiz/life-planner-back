import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  IconApiSchema,
  IconColorApiSchema,
  NameApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TransactionTypeApiSchema,
  hasAtLeastOneField,
} from '@api/finance/v1/dto/finance-fields';

export const CreateCategoryApiSchema = z.object({
  icon: IconApiSchema,
  iconColor: IconColorApiSchema.default('#000000'),
  name: NameApiSchema,
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  parentId: z.uuid().optional(),
  type: TransactionTypeApiSchema,
});

export const UpdateCategoryApiSchema = z
  .object({
    icon: IconApiSchema,
    iconColor: IconColorApiSchema,
    name: NameApiSchema,
    parentId: z.uuid().nullable(),
    type: TransactionTypeApiSchema,
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

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
  type: TransactionTypeApiSchema,
  updatedAt: z.iso.datetime(),
});

export class CategoryOutput extends createZodDto(CategoryApiSchema) {}
export class CreateCategoryBody extends createZodDto(CreateCategoryApiSchema) {}
export class UpdateCategoryBody extends createZodDto(UpdateCategoryApiSchema) {}

export type CreateCategoryApiInput = z.infer<typeof CreateCategoryApiSchema>;
export type UpdateCategoryApiInput = z.infer<typeof UpdateCategoryApiSchema>;

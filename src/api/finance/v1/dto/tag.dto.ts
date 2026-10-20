import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  hasAtLeastOneField,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TagNameApiSchema,
} from '@api/finance/v1/dto/finance-fields';

export const TAG_SCOPES = ['PERSONAL', 'FAMILY', 'ALL'] as const;

// `owner: ALL` (spec 043): the creator's Personal scope plus every family they are in; `ownerId` is then omitted.
export const CreateTagApiSchema = z
  .object({
    name: TagNameApiSchema,
    owner: OwnerTypeApiSchema.or(z.literal('ALL')),
    ownerId: OwnerIdApiSchema.optional(),
  })
  .refine((input) => (input.owner === 'ALL') === (input.ownerId === undefined), {
    message: 'ownerId is required, except for owner ALL where it must be omitted',
  });

export const UpdateTagApiSchema = z
  .object({
    name: TagNameApiSchema,
    // Turns a single-scope tag into an All tag; there is no way back.
    scope: z.literal('ALL'),
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

export const TagApiSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  scope: z.enum(TAG_SCOPES),
  // The scopes the caller can access (for ALL, `owner/ownerId` is the first of them).
  scopes: z.array(z.object({ owner: OwnerTypeApiSchema, ownerId: z.uuid() })),
  updatedAt: z.iso.datetime(),
  usageCount: z.number().int(),
});

// `{ id, name }` on transactions, installment rows and recurrences, in the stored order.
export const TagRefApiSchema = z.object({ id: z.uuid(), name: z.string() });

export type CreateTagApiInput = z.infer<typeof CreateTagApiSchema>;
export type UpdateTagApiInput = z.infer<typeof UpdateTagApiSchema>;

export class CreateTagBody extends createZodDto(CreateTagApiSchema) {}
export class TagOutput extends createZodDto(TagApiSchema) {}
export class UpdateTagBody extends createZodDto(UpdateTagApiSchema) {}

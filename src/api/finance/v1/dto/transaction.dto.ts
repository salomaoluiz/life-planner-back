import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  DescriptionApiSchema,
  IconColorApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TransactionTypeApiSchema,
  ValueApiSchema,
  hasAtLeastOneField,
} from '@api/finance/v1/dto/finance-fields';

const TransactionFieldsSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  date: CalendarDateApiSchema,
  description: DescriptionApiSchema,
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  type: TransactionTypeApiSchema,
  value: ValueApiSchema,
});

export const CreateTransactionApiSchema = TransactionFieldsSchema;

export const UpdateTransactionApiSchema = TransactionFieldsSchema.partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

export const TransactionApiSchema = z.object({
  account: z.object({ icon: z.string(), id: z.uuid(), name: z.string() }),
  accountId: z.uuid(),
  category: z.object({
    icon: z.string(),
    iconColor: IconColorApiSchema,
    id: z.uuid(),
    name: z.string(),
  }),
  categoryId: z.uuid(),
  createdAt: z.iso.datetime(),
  date: z.string(),
  description: z.string(),
  id: z.uuid(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  type: TransactionTypeApiSchema,
  updatedAt: z.iso.datetime(),
  value: z.number().int(),
});

export class CreateTransactionBody extends createZodDto(CreateTransactionApiSchema) {}
export class TransactionOutput extends createZodDto(TransactionApiSchema) {}
export class UpdateTransactionBody extends createZodDto(UpdateTransactionApiSchema) {}

export type CreateTransactionApiInput = z.infer<typeof CreateTransactionApiSchema>;
export type UpdateTransactionApiInput = z.infer<typeof UpdateTransactionApiSchema>;

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  BalanceApiSchema,
  IconApiSchema,
  NameApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  hasAtLeastOneField,
} from '@api/finance/v1/dto/finance-fields';
import { AccountStatus } from '@finance/domain/enum';

const AccountStatusApiSchema = z.enum(AccountStatus);

export const CreateAccountApiSchema = z.object({
  balance: BalanceApiSchema.default(0),
  icon: IconApiSchema,
  name: NameApiSchema,
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  status: AccountStatusApiSchema.default(AccountStatus.ACTIVE),
});

export const UpdateAccountApiSchema = z
  .object({
    balance: BalanceApiSchema,
    icon: IconApiSchema,
    name: NameApiSchema,
    status: AccountStatusApiSchema,
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

export const AccountApiSchema = z.object({
  balance: z.number().int(),
  createdAt: z.iso.datetime(),
  icon: z.string(),
  id: z.uuid(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  status: AccountStatusApiSchema,
  updatedAt: z.iso.datetime(),
});

export class AccountOutput extends createZodDto(AccountApiSchema) {}
export class CreateAccountBody extends createZodDto(CreateAccountApiSchema) {}
export class UpdateAccountBody extends createZodDto(UpdateAccountApiSchema) {}

export type CreateAccountApiInput = z.infer<typeof CreateAccountApiSchema>;
export type UpdateAccountApiInput = z.infer<typeof UpdateAccountApiSchema>;

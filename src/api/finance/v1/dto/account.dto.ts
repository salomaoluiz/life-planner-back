import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  BalanceApiSchema,
  hasAtLeastOneField,
  IconApiSchema,
  NameApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { AccountStatus } from '@finance/domain/enum';

const AccountStatusApiSchema = z.enum(AccountStatus);

export const CreateAccountApiSchema = z
  .object({
    icon: IconApiSchema,
    initialBalance: BalanceApiSchema.default(0),
    name: NameApiSchema,
    owner: OwnerTypeApiSchema,
    ownerId: OwnerIdApiSchema,
    status: AccountStatusApiSchema.default(AccountStatus.ACTIVE),
  })
  .strict();

export const UpdateAccountApiSchema = z
  .object({
    icon: IconApiSchema,
    name: NameApiSchema,
    status: AccountStatusApiSchema,
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

export const AdjustAccountBalanceApiSchema = z.object({ balance: BalanceApiSchema }).strict();

export const AccountApiSchema = z.object({
  // Current balance: initial + transactions dated up to today.
  balance: z.number().int(),
  createdAt: z.iso.datetime(),
  icon: z.string(),
  id: z.uuid(),
  initialBalance: z.number().int(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  // Initial + transactions dated up to the end of today's month.
  projectedBalance: z.number().int(),
  status: AccountStatusApiSchema,
  updatedAt: z.iso.datetime(),
});

export type AdjustAccountBalanceApiInput = z.infer<typeof AdjustAccountBalanceApiSchema>;
export type CreateAccountApiInput = z.infer<typeof CreateAccountApiSchema>;
export type UpdateAccountApiInput = z.infer<typeof UpdateAccountApiSchema>;

export class AccountOutput extends createZodDto(AccountApiSchema) {}
export class AdjustAccountBalanceBody extends createZodDto(AdjustAccountBalanceApiSchema) {}
export class CreateAccountBody extends createZodDto(CreateAccountApiSchema) {}
export class UpdateAccountBody extends createZodDto(UpdateAccountApiSchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  BalanceApiSchema,
  CurrencyApiSchema,
  hasAtLeastOneField,
  IconApiSchema,
  NameApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { AccountStatus } from '@finance/domain/enum';
import { DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';

const AccountStatusApiSchema = z.enum(AccountStatus);

export const CreateAccountApiSchema = z
  .object({
    currency: CurrencyApiSchema.default(DEFAULT_CURRENCY),
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
  currency: CurrencyApiSchema,
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

export const DailyBalancesQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export const DailyBalancesApiSchema = z.object({
  accounts: z.array(
    z.object({
      icon: z.string(),
      id: z.uuid(),
      name: z.string(),
      owner: OwnerTypeApiSchema,
      ownerId: z.uuid(),
    }),
  ),
  days: z.array(
    z.object({
      accounts: z.array(z.object({ accountId: z.uuid(), balance: z.number().int() })),
      cardsDue: z.number().int(),
      date: z.string(),
      projected: z.boolean(),
      total: z.number().int(),
    }),
  ),
  month: z.string(),
});

export type AdjustAccountBalanceApiInput = z.infer<typeof AdjustAccountBalanceApiSchema>;
export type CreateAccountApiInput = z.infer<typeof CreateAccountApiSchema>;
export type UpdateAccountApiInput = z.infer<typeof UpdateAccountApiSchema>;

export class AccountOutput extends createZodDto(AccountApiSchema) {}
export class AdjustAccountBalanceBody extends createZodDto(AdjustAccountBalanceApiSchema) {}
export class CreateAccountBody extends createZodDto(CreateAccountApiSchema) {}
export class DailyBalancesOutput extends createZodDto(DailyBalancesApiSchema) {}
export class UpdateAccountBody extends createZodDto(UpdateAccountApiSchema) {}

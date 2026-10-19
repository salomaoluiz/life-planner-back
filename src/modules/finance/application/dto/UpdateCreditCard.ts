import { z } from 'zod';

import {
  BillingDaySchema,
  CreditCardBrandSchema,
  CreditCardLimitSchema,
  LastDigitsSchema,
} from '@finance/application/dto/CreditCardCommon';
import {
  AccessibleOwnersSchema,
  IconColorSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

const EDITABLE_FIELDS = [
  'brand',
  'closingDay',
  'color',
  'dueDay',
  'lastDigits',
  'limit',
  'owner',
  'ownerId',
  'paymentAccountId',
  'paymentDay',
  'status',
  'title',
] as const;

export const UpdateCreditCardSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    brand: CreditCardBrandSchema.optional(),
    closingDay: BillingDaySchema.optional(),
    color: IconColorSchema.optional(),
    dueDay: BillingDaySchema.optional(),
    id: z.string().min(1),
    lastDigits: LastDigitsSchema.nullable().optional(),
    limit: CreditCardLimitSchema.optional(),
    owner: OwnerTypeSchema.optional(),
    ownerId: OwnerIdSchema.optional(),
    paymentAccountId: z.string().min(1).nullable().optional(),
    paymentDay: BillingDaySchema.nullable().optional(),
    status: z.enum(AccountStatus).optional(),
    title: NameSchema.optional(),
  })
  .refine((input) => EDITABLE_FIELDS.some((field) => input[field] !== undefined), {
    message: 'At least one field is required',
  })
  .refine((input) => (input.owner === undefined) === (input.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

export type UpdateCreditCardInput = z.input<typeof UpdateCreditCardSchema>;

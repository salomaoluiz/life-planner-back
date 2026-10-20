import { z } from 'zod';

import {
  BillingDaySchema,
  CreditCardBrandSchema,
  CreditCardLimitSchema,
  LastDigitsSchema,
} from '@finance/application/dto/CreditCardCommon';
import {
  AccessibleOwnersSchema,
  CurrencySchema,
  IconColorSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';
import { DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';

export const CreateCreditCardSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  brand: CreditCardBrandSchema,
  closingDay: BillingDaySchema,
  color: IconColorSchema,
  currency: CurrencySchema.default(DEFAULT_CURRENCY),
  dueDay: BillingDaySchema,
  lastDigits: LastDigitsSchema.optional(),
  limit: CreditCardLimitSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  paymentAccountId: z.string().min(1).optional(),
  paymentDay: BillingDaySchema.optional(),
  status: z.enum(AccountStatus).default(AccountStatus.ACTIVE),
  title: NameSchema,
});

export type CreateCreditCardInput = z.input<typeof CreateCreditCardSchema>;

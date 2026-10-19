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

export const CreateCreditCardSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  brand: CreditCardBrandSchema,
  closingDay: BillingDaySchema,
  color: IconColorSchema,
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

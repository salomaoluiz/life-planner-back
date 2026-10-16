import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  InvoiceMonthSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { InvoicePaymentMethod } from '@finance/domain/enum';

export const CreateCardEarlyPaymentSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    creditCardId: z.string().min(1),
    date: CalendarDateSchema,
    description: DescriptionSchema,
    invoiceMonth: InvoiceMonthSchema,
    method: z.enum(InvoicePaymentMethod),
    today: CalendarDateSchema,
    value: ValueSchema,
  })
  .refine(
    (input) => (input.method === InvoicePaymentMethod.ACCOUNT) === (input.accountId !== undefined),
    { message: 'accountId is required for ACCOUNT payments and forbidden for EXTERNAL ones' },
  );

export type CreateCardEarlyPaymentInput = z.input<typeof CreateCardEarlyPaymentSchema>;

import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
} from '@finance/application/dto/FinanceCommon';

export const GetPrepaymentPreviewSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  targetInvoiceMonth: InvoiceMonthSchema,
  today: CalendarDateSchema,
});

export type GetPrepaymentPreviewInput = z.input<typeof GetPrepaymentPreviewSchema>;

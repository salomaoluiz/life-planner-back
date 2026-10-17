import { z } from 'zod';

export const ResolveRefundLinkSchema = z.object({
  creditCardId: z.string().min(1),
  refundedPlanId: z.string().min(1).nullish(),
  refundedTransactionId: z.string().min(1).nullish(),
});

export type ResolveRefundLinkInput = z.input<typeof ResolveRefundLinkSchema>;

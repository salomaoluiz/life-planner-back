import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  IdSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@investment/application/dto/InvestmentCommon';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentFixedIncomeRedemptionKind,
} from '@investment/domain/enum';

// Spec 105 FR 7: percentages are > 0 and <= 1000 with up to 4 places.
const PercentSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Invalid percentage')
  .refine((value) => Number(value) > 0 && Number(value) <= 1000, {
    message: 'Must be greater than zero and at most 1000',
  });
const PastDateSchema = CalendarDateSchema.refine((value) => value <= todayInSaoPaulo(), {
  message: 'Date cannot be in the future',
});
const CentsSchema = z.number().int().positive();

function rateVariants<T extends z.ZodRawShape>(extra: T) {
  return z.discriminatedUnion('mode', [
    z.object({
      ...extra,
      annualRate: PercentSchema,
      mode: z.literal(InvestmentFixedIncomeRateMode.PREFIXED),
    }),
    z.object({
      ...extra,
      cdiPercent: PercentSchema,
      indexRate: PercentSchema,
      mode: z.literal(InvestmentFixedIncomeRateMode.CDI_PERCENT),
    }),
    z.object({
      ...extra,
      indexRate: PercentSchema,
      mode: z.literal(InvestmentFixedIncomeRateMode.IPCA_PLUS),
      spread: PercentSchema,
    }),
  ]);
}

// The first rate of a new title starts on the first contribution date, so it carries no `startDate`.
export const FirstRateSchema = rateVariants({});
export const RateSchema = rateVariants({ startDate: CalendarDateSchema });
export type RateInput = z.input<typeof RateSchema>;

export const TermsSchema = z
  .object({
    liquidity: z.enum(InvestmentFixedIncomeLiquidity),
    liquidityDate: CalendarDateSchema.nullish(),
    maturityDate: CalendarDateSchema,
    product: z.enum(InvestmentFixedIncomeProduct),
    taxExempt: z.boolean(),
  })
  .superRefine((terms, ctx) => {
    const grace = terms.liquidity === InvestmentFixedIncomeLiquidity.GRACE_PERIOD;

    if (grace && !terms.liquidityDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Required for a grace period',
        path: ['liquidityDate'],
      });
    }
    if (!grace && terms.liquidityDate) {
      ctx.addIssue({ code: 'custom', message: 'Must be empty', path: ['liquidityDate'] });
    }
  });

const ContributionFields = {
  accountId: IdSchema.nullish(),
  amount: CentsSchema,
  date: PastDateSchema,
  generateTransaction: z.boolean().default(true),
};
const RedemptionFields = {
  accountId: IdSchema.nullish(),
  date: PastDateSchema,
  generateTransaction: z.boolean().default(true),
  kind: z.enum(InvestmentFixedIncomeRedemptionKind),
  netAmount: CentsSchema,
};
const accountRule = {
  message: 'accountId is required when generating a finance entry, and must be empty otherwise',
  path: ['accountId'],
};

export const CreateFixedIncomeTitleSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  contribution: z
    .object(ContributionFields)
    .refine((input) => input.generateTransaction === !!input.accountId, accountRule),
  name: NameSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  rate: FirstRateSchema,
  terms: TermsSchema,
});
export type CreateFixedIncomeTitleInput = z.input<typeof CreateFixedIncomeTitleSchema>;

export const UpsertFixedIncomeTermsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  rate: RateSchema.optional(),
  terms: TermsSchema,
});
export type UpsertFixedIncomeTermsInput = z.input<typeof UpsertFixedIncomeTermsSchema>;

export const CreateFixedIncomeRateSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  rate: RateSchema,
});
export type CreateFixedIncomeRateInput = z.input<typeof CreateFixedIncomeRateSchema>;

export const UpdateFixedIncomeRateSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  rate: RateSchema,
});
export type UpdateFixedIncomeRateInput = z.input<typeof UpdateFixedIncomeRateSchema>;

export const FixedIncomeIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export type FixedIncomeIdInput = z.input<typeof FixedIncomeIdSchema>;

export const UpsertFixedIncomeAdjustmentSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  date: PastDateSchema,
  grossAmount: CentsSchema,
});
export type UpsertFixedIncomeAdjustmentInput = z.input<typeof UpsertFixedIncomeAdjustmentSchema>;

export const CreateFixedIncomeContributionSchema = z
  .object({ accessibleOwners: AccessibleOwnersSchema, assetId: IdSchema, ...ContributionFields })
  .refine((input) => input.generateTransaction === !!input.accountId, accountRule);
export type CreateFixedIncomeContributionInput = z.input<
  typeof CreateFixedIncomeContributionSchema
>;

export const CreateFixedIncomeRedemptionSchema = z
  .object({ accessibleOwners: AccessibleOwnersSchema, assetId: IdSchema, ...RedemptionFields })
  .refine((input) => input.generateTransaction === !!input.accountId, accountRule);
export type CreateFixedIncomeRedemptionInput = z.input<typeof CreateFixedIncomeRedemptionSchema>;

// Spec 105 FR 34: nothing is written, so the date only has to be a calendar day.
export const SimulateFixedIncomeSchema = z.object({
  amount: CentsSchema,
  date: CalendarDateSchema,
  maturityDate: CalendarDateSchema,
  rate: FirstRateSchema,
  taxExempt: z.boolean(),
});
export type SimulateFixedIncomeInput = z.input<typeof SimulateFixedIncomeSchema>;

export const PreviewFixedIncomeRedemptionSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  date: CalendarDateSchema,
  kind: z.enum(InvestmentFixedIncomeRedemptionKind),
  netAmount: CentsSchema,
});
export type PreviewFixedIncomeRedemptionInput = z.input<typeof PreviewFixedIncomeRedemptionSchema>;

// Contribution / redemption edits through the generic `PATCH /operations/:id` (spec 105 section 7).
export const UpdateFixedIncomeOperationSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: IdSchema.nullish(),
  amount: CentsSchema.optional(),
  date: PastDateSchema.optional(),
  generateTransaction: z.boolean().optional(),
  id: IdSchema,
  kind: z.enum(InvestmentFixedIncomeRedemptionKind).optional(),
  netAmount: CentsSchema.optional(),
});
export type UpdateFixedIncomeOperationInput = z.input<typeof UpdateFixedIncomeOperationSchema>;

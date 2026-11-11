import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DecimalStringSchema,
  FeesSchema,
  IdSchema,
  OwnerIdSchema,
  PositiveDecimalSchema,
} from '@investment/application/dto/InvestmentCommon';
import { today } from '@investment/application/service/Today';
import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

const MAX_RATIO = Decimal8.parse('1000000');
const MAX_BONUS_PERCENT = Decimal8.parse('1000');

const PastDateSchema = CalendarDateSchema.refine((value) => value <= today(), {
  message: 'Date cannot be in the future',
});

// Spec 108 FR 4-5: ratios up to 1 000 000, bonus percent up to 1 000, both with up to 8 places.
const RatioSchema = PositiveDecimalSchema.refine((value) => value.compare(MAX_RATIO) <= 0, {
  message: 'Ratio is too large',
});
const BonusPercentSchema = PositiveDecimalSchema.refine(
  (value) => value.compare(MAX_BONUS_PERCENT) <= 0,
  { message: 'Percent is too large' },
);

export const EventTypeSchema = z.enum([
  InvestmentOperationType.SPLIT,
  InvestmentOperationType.REVERSE_SPLIT,
  InvestmentOperationType.BONUS,
]);

// The fields of the three event types; which ones are required depends on the type.
export const eventFields = {
  bonusPercent: BonusPercentSchema,
  bonusUnitCost: DecimalStringSchema,
  ratioFrom: RatioSchema,
  ratioTo: RatioSchema,
};

export interface EventShape {
  bonusPercent?: Decimal8 | null;
  bonusUnitCost?: Decimal8 | null;
  ratioFrom?: Decimal8 | null;
  ratioTo?: Decimal8 | null;
  type: InvestmentOperationType;
}

// FR 4-5: SPLIT needs ratioTo > ratioFrom, REVERSE_SPLIT ratioTo < ratioFrom, BONUS a percent; nothing from the
// other kind.
export function checkEventShape(input: EventShape, ctx: z.RefinementCtx): void {
  // A field that failed its own check reaches this refine unparsed: its issue is already reported.
  const fields = [input.bonusPercent, input.bonusUnitCost, input.ratioFrom, input.ratioTo];

  if (fields.some((value) => value != null && !(value instanceof Decimal8))) {
    return;
  }

  function issue(message: string, path: string): void {
    ctx.addIssue({ code: 'custom', message, path: [path] });
  }
  const hasRatio = input.ratioFrom != null || input.ratioTo != null;
  const hasBonus = input.bonusPercent != null || input.bonusUnitCost != null;

  if (input.type === InvestmentOperationType.BONUS) {
    if (input.bonusPercent == null) {
      issue('bonusPercent is required', 'bonusPercent');
    }
    if (hasRatio) {
      issue('A bonus has no ratio', 'ratioFrom');
    }

    return;
  }

  if (hasBonus) {
    issue('This field does not apply to a split', 'bonusPercent');
  }
  if (input.ratioFrom == null || input.ratioTo == null) {
    issue('ratioFrom and ratioTo are required', 'ratioFrom');

    return;
  }

  const order = input.ratioTo.compare(input.ratioFrom);

  if (input.type === InvestmentOperationType.SPLIT && order <= 0) {
    issue('A split needs ratioTo greater than ratioFrom', 'ratioTo');
  }
  if (input.type === InvestmentOperationType.REVERSE_SPLIT && order >= 0) {
    issue('A reverse split needs ratioTo smaller than ratioFrom', 'ratioTo');
  }
}

// An event's fields after an edit merged them into the stored ones (spec 108 FR 20).
export const EventShapeSchema = z
  .custom<EventShape>()
  .superRefine((input, ctx) => checkEventShape(input, ctx));

// Events carry none of the BUY/SELL fields and never a finance row (FR 6): unknown keys answer 400.
export const CreateEventSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    assetId: IdSchema,
    date: PastDateSchema,
    generateTransaction: z.literal(false).optional(),
    type: EventTypeSchema,
    ...z.object(eventFields).partial().shape,
    bonusUnitCost: eventFields.bonusUnitCost.nullish(),
  })
  .strict()
  .superRefine(checkEventShape);
export type CreateEventInput = z.input<typeof CreateEventSchema>;

// Spec 108 FR 15: the cash of a fraction auction. `grossAmount` 0 writes the fraction off (no finance entry).
export const CreateFractionSaleSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: IdSchema.nullish(),
    date: PastDateSchema,
    eventId: IdSchema,
    fees: FeesSchema.default([]),
    generateTransaction: z.boolean().default(true),
    grossAmount: z.number().int().min(0),
  })
  .refine((input) => input.generateTransaction === !!input.accountId, {
    message: 'accountId is required when generating a finance entry, and must be empty otherwise',
    path: ['accountId'],
  })
  .refine((input) => input.grossAmount > 0 || !input.generateTransaction, {
    message: 'grossAmount must be greater than zero when generating a finance entry',
    path: ['grossAmount'],
  });
export type CreateFractionSaleInput = z.input<typeof CreateFractionSaleSchema>;

export const GetEventSuggestionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema.optional(),
  cursor: IdSchema.optional(),
  limit: z.number().int().min(1).max(200).default(200),
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: OwnerIdSchema.optional(),
});
export type GetEventSuggestionsInput = z.input<typeof GetEventSuggestionsSchema>;

// Approving with an empty body takes the suggestion as it is; any field overrides it (FR 29, the edit path).
export const ApproveEventSuggestionSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    date: PastDateSchema.optional(),
    id: IdSchema,
    type: EventTypeSchema.optional(),
    userId: IdSchema,
    ...z.object(eventFields).partial().shape,
    bonusUnitCost: eventFields.bonusUnitCost.nullish(),
  })
  .strict();
export type ApproveEventSuggestionInput = z.input<typeof ApproveEventSuggestionSchema>;

export const DecideEventSuggestionSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  userId: IdSchema,
});
export type DecideEventSuggestionInput = z.input<typeof DecideEventSuggestionSchema>;

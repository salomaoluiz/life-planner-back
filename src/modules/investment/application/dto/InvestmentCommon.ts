import { z } from 'zod';

import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFeeKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { SUPPORTED_CURRENCIES } from '@investment/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

export const MAX_QUANTITY = Decimal8.parse('9999999999.99999999');

export const AccessibleOwnersSchema = z.array(
  z.object({
    archived: z.boolean().optional(),
    owner: z.enum(OwnerType),
    ownerId: z.string().min(1),
  }),
);
export const AssetClassSchema = z.enum(InvestmentAssetClass);
export const AssetStatusSchema = z.enum(InvestmentAssetStatus);
export const CurrencySchema = z.enum(SUPPORTED_CURRENCIES);
export const IdSchema = z.string().min(1);
export const NameSchema = z.string().trim().min(1).max(100);
export const OperationTypeSchema = z.enum(InvestmentOperationType);
export const OwnerIdSchema = z.string().min(1);
export const OwnerTypeSchema = z.enum(OwnerType);
export const TickerSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9.-]{1,20}$/, 'Invalid ticker'));

// Decimal string with up to 8 places (quantity and unit price travel as strings, never floats).
export const DecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,8})?$/, 'Invalid decimal')
  .transform((value) => Decimal8.parse(value));
export const PositiveDecimalSchema = DecimalStringSchema.refine((value) => value.isPositive(), {
  message: 'Must be greater than zero',
});
export const QuantitySchema = PositiveDecimalSchema.refine(
  (value) => value.compare(MAX_QUANTITY) <= 0,
  { message: 'Quantity is too large' },
);

export const CalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

// Spec 105 FR 20: the withheld taxes of a fixed income redemption are written by the calculation only.
const SYSTEM_FEE_KINDS = [InvestmentFeeKind.INCOME_TAX, InvestmentFeeKind.IOF];

export const FeeSchema = z
  .object({
    amount: z.number().int().positive(),
    description: z.string().trim().min(1).max(60).nullish(),
    kind: z.enum(InvestmentFeeKind),
  })
  .superRefine((fee, ctx) => {
    if (SYSTEM_FEE_KINDS.includes(fee.kind)) {
      ctx.addIssue({ code: 'custom', message: 'This fee is set by the system', path: ['kind'] });
    }
    if (fee.kind === InvestmentFeeKind.OTHER && !fee.description) {
      ctx.addIssue({ code: 'custom', message: 'Description is required', path: ['description'] });
    }
    if (fee.kind !== InvestmentFeeKind.OTHER && fee.description) {
      ctx.addIssue({ code: 'custom', message: 'Description must be empty', path: ['description'] });
    }
  })
  .transform((fee) => ({
    amount: fee.amount,
    description: fee.description ?? null,
    kind: fee.kind,
  }));
export const FeesSchema = z.array(FeeSchema).max(10);

// BRL per 1 unit of the foreign currency (spec 104): up to 6 places, positive.
export const FxRateSchema = z
  .string()
  .regex(/^\d{1,6}(\.\d{1,6})?$/, 'Invalid exchange rate')
  .refine((value) => Number(value) > 0, { message: 'Must be greater than zero' });

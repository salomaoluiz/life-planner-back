import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OptionalDaySchema,
  OptionalTodaySchema,
  PositiveQuantitySchema,
  QuantitySchema,
} from '@stock/application/dto/StockCommon';
import { StockMovementReasons } from '@stock/domain/entity/StockMovementEntity';

const NoteSchema = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((value) => (value === '' ? undefined : (value ?? undefined)));
const LotIdSchema = z
  .string()
  .min(1)
  .nullish()
  .transform((value) => value ?? undefined);

const ExpiredLotsSchema = z.enum(['DISCARD_THEN_VALID', 'EXPIRED_FIRST', 'VALID_ONLY']).optional();
const base = {
  accessibleOwners: AccessibleOwnersSchema,
  clientId: z.uuid().optional(),
  expiredLots: ExpiredLotsSchema,
  gestureId: z.uuid().optional(),
  itemId: z.string().min(1),
  note: NoteSchema,
  today: OptionalTodaySchema,
  userId: z.string().min(1),
};

// Spec 116 FR 8-17: one body per movement type.
export const CreateStockMovementSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    expirationDate: OptionalDaySchema,
    purchaseDate: OptionalDaySchema,
    quantity: PositiveQuantitySchema,
    reason: z
      .enum([StockMovementReasons.PURCHASE, StockMovementReasons.MANUAL])
      .default(StockMovementReasons.PURCHASE),
    target: z.literal('LATEST_CLOSED').optional(),
    type: z.literal('ENTRY'),
  }),
  z.object({
    ...base,
    lotId: LotIdSchema,
    quantity: PositiveQuantitySchema,
    type: z.literal('CONSUME'),
  }),
  z.object({
    ...base,
    lotId: LotIdSchema,
    quantity: PositiveQuantitySchema.default(1),
    type: z.literal('OPEN'),
  }),
  z.object({
    ...base,
    lotId: z.string().min(1),
    quantity: PositiveQuantitySchema.optional(),
    reason: z.enum([
      StockMovementReasons.EXPIRED,
      StockMovementReasons.SPOILED,
      StockMovementReasons.OTHER,
    ]),
    type: z.literal('DISCARD'),
  }),
  z.object({
    ...base,
    countedQuantity: QuantitySchema,
    lotId: LotIdSchema,
    type: z.literal('ADJUST'),
  }),
]);

export type CreateStockMovementInput = z.input<typeof CreateStockMovementSchema>;

export const GetStockMovementsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  cursor: z.string().min(1).optional(),
  itemId: z.string().min(1),
});

export type GetStockMovementsInput = z.input<typeof GetStockMovementsSchema>;

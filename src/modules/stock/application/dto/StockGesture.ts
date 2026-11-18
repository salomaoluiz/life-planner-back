import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  DaySchema,
  OptionalTodaySchema,
} from '@stock/application/dto/StockCommon';

const base = {
  accessibleOwners: AccessibleOwnersSchema,
  gestureId: z.uuid(),
  now: z.date().optional(),
  userId: z.string().min(1),
};

export const UndoStockGestureSchema = z.object(base);
export const SetGestureExpirationSchema = z.object({
  ...base,
  expirationDate: DaySchema,
  today: OptionalTodaySchema,
});

export type SetGestureExpirationInput = z.input<typeof SetGestureExpirationSchema>;
export type UndoStockGestureInput = z.input<typeof UndoStockGestureSchema>;

import { z } from 'zod';

import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const INT4_MAX = 2147483647;
export const INT4_MIN = -2147483648;

export const AccessibleOwnersSchema = z.array(
  z.object({ owner: z.enum(OwnerType), ownerId: z.string().min(1) }),
);
export const BalanceSchema = z.number().int().min(INT4_MIN).max(INT4_MAX);
export const IconSchema = z.string().trim().min(1).max(50);
export const NameSchema = z.string().trim().min(1).max(60);
export const OwnerIdSchema = z.string().min(1);
export const OwnerTypeSchema = z.enum(OwnerType);
export const IconColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const TransactionTypeSchema = z.enum(TransactionType);

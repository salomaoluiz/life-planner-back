import { z } from 'zod';

import { INT4_MAX, INT4_MIN } from '@finance/application/dto/FinanceCommon';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const BalanceApiSchema = z.number().int().min(INT4_MIN).max(INT4_MAX);
export const IconApiSchema = z.string().trim().min(1).max(50);
export const IconColorApiSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const NameApiSchema = z.string().trim().min(1).max(60);
export const OwnerIdApiSchema = z.uuid();
export const OwnerTypeApiSchema = z.enum(OwnerType);
export const TransactionTypeApiSchema = z.enum(TransactionType);

// PATCH bodies: `.partial().strict()` rejects unknown keys (incl. owner/ownerId) AND `{}` is rejected here.
export function hasAtLeastOneField(value: object): boolean {
  return Object.values(value).some((field) => field !== undefined);
}

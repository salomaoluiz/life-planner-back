import { z } from 'zod';

import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import { CreditCardBrand } from '@finance/domain/enum';

export const BillingDaySchema = z.number().int().min(1).max(31);
export const CreditCardBrandSchema = z.enum(CreditCardBrand);
// Integer cents, 1 … INT4_MAX.
export const CreditCardLimitSchema = z.number().int().min(1).max(INT4_MAX);
export const LastDigitsSchema = z.string().regex(/^\d{4}$/);

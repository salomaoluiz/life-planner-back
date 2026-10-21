import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';

import { importRowKind, isSkippableSystemRow, parseInvoiceMonth } from './index';

const ID = SYSTEM_CATEGORY_IDS;
const regular = 'cat-1';

describe('importRowKind', () => {
  it.each([
    ['ACCOUNT_TRANSACTION', { accountId: 'a', categoryId: regular, type: TransactionType.EXPENSE }],
    ['ACCOUNT_TRANSACTION', { accountId: 'a', categoryId: regular, type: TransactionType.INCOME }],
    ['CARD_PURCHASE', { categoryId: regular, creditCardId: 'c', type: TransactionType.EXPENSE }],
    [
      'REFUND',
      {
        categoryId: ID[SystemCategoryKey.CARD_REFUND],
        creditCardId: 'c',
        type: TransactionType.INCOME,
      },
    ],
    [
      'PREPAYMENT_DISCOUNT',
      {
        categoryId: ID[SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT],
        creditCardId: 'c',
        type: TransactionType.INCOME,
      },
    ],
    [
      'EARLY_PAYMENT',
      {
        categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT],
        creditCardId: 'c',
        type: TransactionType.INCOME,
      },
    ],
    [
      'EARLY_PAYMENT',
      {
        accountId: 'a',
        categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT],
        creditCardId: 'c',
        type: TransactionType.INCOME,
      },
    ],
    [
      'INVOICE_PAYMENT',
      {
        accountId: 'a',
        categoryId: ID[SystemCategoryKey.INVOICE_PAYMENT],
        creditCardId: 'c',
        type: TransactionType.EXPENSE,
      },
    ],
    [
      'INVOICE_PAYMENT',
      {
        categoryId: ID[SystemCategoryKey.INVOICE_PAYMENT],
        creditCardId: 'c',
        type: TransactionType.EXPENSE,
      },
    ],
  ])('SHOULD give %s', (kind, row) => {
    expect(importRowKind(row)).toBe(kind);
  });

  it.each([
    [
      'CARD_INCOME_CATEGORY',
      { categoryId: regular, creditCardId: 'c', type: TransactionType.INCOME },
    ],
    [
      'CARD_CREDIT_CATEGORY_MISUSED',
      {
        accountId: 'a',
        categoryId: ID[SystemCategoryKey.CARD_REFUND],
        type: TransactionType.INCOME,
      },
    ],
    [
      'CARD_CREDIT_CATEGORY_MISUSED',
      {
        categoryId: ID[SystemCategoryKey.CARD_REFUND],
        creditCardId: 'c',
        type: TransactionType.EXPENSE,
      },
    ],
    [
      'CARD_CREDIT_CATEGORY_MISUSED',
      {
        categoryId: ID[SystemCategoryKey.INVOICE_PAYMENT],
        creditCardId: 'c',
        type: TransactionType.INCOME,
      },
    ],
    [
      'ACCOUNT_AND_CARD',
      { accountId: 'a', categoryId: regular, creditCardId: 'c', type: TransactionType.EXPENSE },
    ],
  ])('SHOULD report %s', (error, row) => {
    expect(importRowKind(row)).toEqual({ error });
  });
});

describe('isSkippableSystemRow', () => {
  it('SHOULD skip balance adjustments and a payment on an account without a card', () => {
    expect(
      isSkippableSystemRow({
        accountId: 'a',
        categoryId: ID[SystemCategoryKey.BALANCE_ADJUSTMENT],
      }),
    ).toBe(true);
    expect(
      isSkippableSystemRow({ accountId: 'a', categoryId: ID[SystemCategoryKey.INVOICE_PAYMENT] }),
    ).toBe(true);
    expect(
      isSkippableSystemRow({
        accountId: 'a',
        categoryId: ID[SystemCategoryKey.INVOICE_PAYMENT],
        creditCardId: 'c',
      }),
    ).toBe(false);
  });
});

describe('parseInvoiceMonth', () => {
  it.each([
    ['2026-09', '2026-09'],
    [undefined, undefined],
    [null, undefined],
    ['', undefined],
  ])('SHOULD read %s as %s', (raw, expected) => {
    expect(parseInvoiceMonth(raw)).toBe(expected);
  });

  it.each(['2026-13', '2026-9', '09/2026', 'x'])('SHOULD reject %s', (raw) => {
    expect(parseInvoiceMonth(raw)).toBe('INVALID');
  });
});

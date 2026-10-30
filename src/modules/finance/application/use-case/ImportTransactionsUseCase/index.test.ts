import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

const { base, validRow } = mocks;

describe('dry run', () => {
  it('SHOULD report no error and write nothing for valid rows', async () => {
    const result = await setup.execute({ ...base, rows: [validRow] });

    expect(result).toEqual({ created: 0, duplicates: [], errors: [], invoices: [] });
    expect(mocks.transactionRepository.createManyTransactions).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_DATE', { date: '2026-09-31' }],
    ['INVALID_DATE', { date: '1899-12-31' }],
    ['INVALID_DATE', { date: '2101-01-01' }],
    ['INVALID_VALUE', { value: 0 }],
    ['INVALID_VALUE', { value: 12.5 }],
    ['DESCRIPTION_INVALID', { description: '   ' }],
    ['DESCRIPTION_INVALID', { description: 'x'.repeat(201) }],
    ['TOO_MANY_TAGS', { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
    ['TAG_TOO_LONG', { tags: ['x'.repeat(31)] }],
    ['NOTES_TOO_LONG', { notes: 'x'.repeat(1001) }],
    ['UNSUPPORTED_CURRENCY', { currency: 'JPY' }],
    ['ACCOUNT_AND_CARD', { creditCardId: 'card-1' }],
    [
      'CARD_INCOME_CATEGORY',
      { accountId: undefined, creditCardId: 'card-1', type: TransactionType.INCOME },
    ],
    [
      'INVOICE_MONTH_INVALID',
      { accountId: undefined, creditCardId: 'card-1', invoiceMonth: '2026-13' },
    ],
  ])('SHOULD report %s without a lookup', async (code, override) => {
    const result = await setup.execute({ ...base, rows: [{ ...validRow, ...override }] });

    expect(result.errors).toEqual([expect.objectContaining({ code, line: 2 })]);
    expect(mocks.ensure.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['Account not found', 'ACCOUNT_NOT_FOUND', mocks.errors.notFound],
    ['Credit card not found', 'CARD_NOT_FOUND', mocks.errors.notFound],
    ['Category not found', 'CATEGORY_NOT_FOUND', mocks.errors.notFound],
    ['Account is archived', 'ACCOUNT_ARCHIVED', mocks.errors.unprocessable],
    ['Category is archived', 'CATEGORY_ARCHIVED', mocks.errors.unprocessable],
    ['System category is reserved', 'SYSTEM_CATEGORY', mocks.errors.unprocessable],
    [
      'Transaction currency must match the account currency',
      'CURRENCY_MISMATCH',
      mocks.errors.unprocessable,
    ],
  ])('SHOULD map "%s" to %s', async (message, code, build) => {
    mocks.ensure.execute.mockRejectedValueOnce(build(message));

    const result = await setup.execute({ ...base, rows: [validRow] });

    expect(result.errors).toEqual([{ code, line: 2, message }]);
  });

  it('SHOULD rethrow an error it does not know', async () => {
    mocks.ensure.execute.mockRejectedValueOnce(new Error('boom'));

    await expect(setup.execute({ ...base, rows: [validRow] })).rejects.toThrow('boom');
  });

  it('SHOULD look each category/account combination up once, not once per row', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...validRow,
      line: i + 2,
      value: 100 + i,
    }));

    await setup.execute({ ...base, rows });

    expect(mocks.ensure.execute).toHaveBeenCalledTimes(1);
  });

  it('SHOULD flag a row that repeats an existing transaction, and the second copy inside the file', async () => {
    mocks.transactionRepository.findDuplicateCandidates.mockResolvedValueOnce([
      {
        accountId: 'acc-1',
        creditCardId: null,
        date: '2026-10-02',
        description: 'SUPERMERCADO',
        type: TransactionType.EXPENSE,
        value: 31240,
      },
    ]);

    const result = await setup.execute({
      ...base,
      rows: [
        validRow,
        { ...validRow, description: 'Farmácia', line: 3, value: 5000 },
        { ...validRow, description: 'farmacia', line: 4, value: 5000 },
      ],
    });

    expect(result.duplicates).toEqual([2, 4]);
    expect(mocks.transactionRepository.findDuplicateCandidates).toHaveBeenCalledWith({
      from: '2026-10-02',
      owner: { owner: 'USER', ownerId: 'user-id' },
      to: '2026-10-02',
    });
  });
});

describe('commit', () => {
  it('SHOULD write every row in one call and return how many', async () => {
    const result = await setup.execute({
      ...base,
      dryRun: false,
      rows: [validRow, { ...validRow, line: 3, paid: false, tags: [' fixo ', 'Fixo', ''] }],
    });

    expect(result.created).toBe(2);
    expect(mocks.transactionRepository.createManyTransactions).toHaveBeenCalledTimes(1);
    expect(mocks.transactionRepository.createManyTransactions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ accountId: 'acc-1', currency: 'BRL', paid: true, tags: undefined }),
      expect.objectContaining({ paid: false, tags: ['fixo'] }),
    ]);
  });

  it('SHOULD store the trimmed notes of a normal row AND null for an empty one (spec 059)', async () => {
    await setup.execute({
      ...base,
      dryRun: false,
      rows: [
        { ...validRow, notes: '  Casa\nAeroporto ' },
        { ...validRow, line: 3, notes: '   ' },
        { ...validRow, line: 4 },
      ],
    });

    const written = mocks.transactionRepository.createManyTransactions.mock.calls[0][0];

    expect(written.map((row: { notes: null | string }) => row.notes)).toEqual([
      'Casa\nAeroporto',
      null,
      null,
    ]);
  });

  it('SHOULD leave a future account row unpaid by default', async () => {
    await setup.execute({
      ...base,
      dryRun: false,
      rows: [{ ...validRow, date: '2026-12-01' }],
    });

    expect(mocks.transactionRepository.createManyTransactions.mock.calls[0][0][0].paid).toBe(false);
  });

  it('SHOULD give a card row its invoice month from the closing day and no paid status', async () => {
    await setup.execute({
      ...base,
      dryRun: false,
      rows: [
        {
          ...validRow,
          accountId: undefined,
          creditCardId: 'card-1',
          date: '2026-10-09',
          paid: true,
        },
        { ...validRow, accountId: undefined, creditCardId: 'card-1', date: '2026-10-11', line: 3 },
      ],
    });

    const [first, second] = mocks.transactionRepository.createManyTransactions.mock.calls[0][0];

    expect(first).toEqual(expect.objectContaining({ invoiceMonth: '2026-10', paid: undefined }));
    expect(second.invoiceMonth).toBe('2026-11');
  });

  it('SHOULD refuse with 422 and the errors, writing nothing, WHEN any row is invalid', async () => {
    const failing = setup.execute({
      ...base,
      dryRun: false,
      rows: [validRow, { ...validRow, date: '2026-02-30', line: 3 }],
    });

    await expect(failing).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(failing).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'INVALID_DATE', line: 3 })] },
    });
    expect(mocks.transactionRepository.createManyTransactions).not.toHaveBeenCalled();
  });
});

describe('owner', () => {
  it('SHOULD answer 403 for an owner the caller cannot reach', async () => {
    await expect(
      setup.execute({ ...base, owner: 'FAMILY' as never, ownerId: 'stranger', rows: [validRow] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SHOULD answer 422 for an archived family', async () => {
    await expect(
      setup.execute({
        ...base,
        owner: 'FAMILY' as never,
        ownerId: 'archived-family',
        rows: [validRow],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SHOULD refuse 0 rows and more than 2,000 rows', async () => {
    await expect(setup.execute({ ...base, rows: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      setup.execute({
        ...base,
        rows: Array.from({ length: 2001 }, (_, i) => ({ ...validRow, line: i + 2 })),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('owner per row (spec 047)', () => {
  const familyRow = { ...validRow, line: 3, owner: 'FAMILY' as never, ownerId: 'family-id' };

  it('SHOULD import a row in the family it names and the others in the owner of the request', async () => {
    const owners = [...base.accessibleOwners, { owner: 'FAMILY' as never, ownerId: 'family-id' }];

    await setup.execute({
      ...base,
      accessibleOwners: owners,
      dryRun: false,
      rows: [validRow, familyRow],
    });

    const [first, second] = mocks.transactionRepository.createManyTransactions.mock.calls[0][0];

    expect([first.owner, first.ownerId]).toEqual(['USER', 'user-id']);
    expect([second.owner, second.ownerId]).toEqual(['FAMILY', 'family-id']);
  });

  it('SHOULD look the account up in the owner of each row, even with the same ids', async () => {
    const owners = [...base.accessibleOwners, { owner: 'FAMILY' as never, ownerId: 'family-id' }];

    await setup.execute({ ...base, accessibleOwners: owners, rows: [validRow, familyRow] });

    expect(mocks.ensure.execute).toHaveBeenCalledTimes(2);
    expect(mocks.ensure.execute.mock.calls.map(([call]) => call.ownerId)).toEqual([
      'user-id',
      'family-id',
    ]);
  });

  it.each([
    ['stranger', 'OWNER_NOT_ACCESSIBLE'],
    ['archived-family', 'OWNER_ARCHIVED'],
  ])('SHOULD report a row of the owner %s as %s, not fail the request', async (ownerId, code) => {
    const result = await setup.execute({
      ...base,
      rows: [validRow, { ...familyRow, ownerId }],
    });

    expect(result.errors).toEqual([expect.objectContaining({ code, line: 3 })]);
  });

  it('SHOULD look for duplicates in the owner of each row', async () => {
    const owners = [...base.accessibleOwners, { owner: 'FAMILY' as never, ownerId: 'family-id' }];

    await setup.execute({ ...base, accessibleOwners: owners, rows: [validRow, familyRow] });

    expect(
      mocks.transactionRepository.findDuplicateCandidates.mock.calls.map(([call]) => call.owner),
    ).toEqual([
      { owner: 'USER', ownerId: 'user-id' },
      { owner: 'FAMILY', ownerId: 'family-id' },
    ]);
  });
});

describe('card credits and invoice payments (spec 048)', () => {
  const ID = SYSTEM_CATEGORY_IDS;
  const cardRow = {
    categoryId: 'cat-1',
    creditCardId: 'card-1',
    date: '2026-09-10',
    description: 'Mercado',
    invoiceMonth: '2026-09',
    line: 2,
    type: TransactionType.EXPENSE,
    value: 100000,
  };
  const refund = {
    ...cardRow,
    categoryId: ID[SystemCategoryKey.CARD_REFUND],
    description: 'Estorno',
    line: 3,
    type: TransactionType.INCOME,
    value: 1200,
  };
  const discount = {
    ...refund,
    categoryId: ID[SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT],
    line: 4,
    value: 300,
  };
  const payment = {
    ...cardRow,
    accountId: 'acc-1',
    categoryId: ID[SystemCategoryKey.INVOICE_PAYMENT],
    date: '2026-10-02',
    description: 'Pagamento',
    line: 5,
    value: 98500,
  };

  it('SHOULD write purchases, 2 credits and the payment in one call WHEN the payment equals the invoice', async () => {
    const result = await setup.execute({
      ...base,
      dryRun: false,
      rows: [cardRow, refund, discount, payment],
    });

    expect(result.created).toBe(4);
    expect(mocks.transactionRepository.createManyTransactions).not.toHaveBeenCalled();

    const call = mocks.cardCredit.createImportRows.mock.calls[0][0];

    expect(call.purchases).toEqual([
      expect.objectContaining({ invoiceMonth: '2026-09', value: 100000 }),
    ]);
    expect(call.refunds.map((r: { categoryId: string }) => r.categoryId)).toEqual([
      ID[SystemCategoryKey.CARD_REFUND],
      ID[SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT],
    ]);
    expect(call.payments).toEqual([
      expect.objectContaining({
        accountId: 'acc-1',
        amount: 98500,
        description: 'Invoice payment · Visa (2026-09)',
        invoiceMonth: '2026-09',
        method: 'ACCOUNT',
        paidOn: '2026-10-02',
      }),
    ]);
  });

  it('SHOULD report INVOICE_PAYMENT_MISMATCH on the line AND answer 422 on import WHEN the payment is 1.000', async () => {
    const rows = [cardRow, refund, discount, { ...payment, value: 100000 }];
    const dry = await setup.execute({ ...base, rows });

    expect(dry.errors).toEqual([
      expect.objectContaining({ code: 'INVOICE_PAYMENT_MISMATCH', line: 5 }),
    ]);
    await expect(setup.execute({ ...base, dryRun: false, rows })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.cardCredit.createImportRows).not.toHaveBeenCalled();
  });

  it('SHOULD return the invoices the file touches on a dry run', async () => {
    const result = await setup.execute({ ...base, rows: [cardRow, refund, discount, payment] });

    expect(result.invoices).toEqual([
      { amountDue: 98500, creditCardId: 'card-1', invoiceMonth: '2026-09', paid: true },
    ]);
  });

  it('SHOULD write an early payment without an account as EXTERNAL AND with one as ACCOUNT, with the card description kept', async () => {
    const early = {
      ...refund,
      categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT],
      date: '2026-10-16',
      description: 'Adiantamento',
      invoiceMonth: '2026-10',
      value: 60000,
    };

    await setup.execute({
      ...base,
      dryRun: false,
      rows: [
        { ...cardRow, date: '2026-10-02', invoiceMonth: '2026-10' },
        { ...early, line: 3 },
        { ...early, accountId: 'acc-1', line: 4, value: 20000 },
      ],
    });

    const { earlyPayments } = mocks.cardCredit.createImportRows.mock.calls[0][0];

    expect(earlyPayments.map((e: { method: string }) => e.method)).toEqual(['EXTERNAL', 'ACCOUNT']);
    expect(earlyPayments[1]).toEqual(
      expect.objectContaining({
        account: expect.objectContaining({ id: 'acc-1' }),
        accountDescription: 'Early payment · Visa (2026-10)',
        description: 'Adiantamento',
      }),
    );
  });

  it('SHOULD flag every early payment WHEN the sum passes the due', async () => {
    const early = {
      ...refund,
      categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT],
      date: '2026-10-16',
      invoiceMonth: '2026-10',
    };

    const result = await setup.execute({
      ...base,
      rows: [
        { ...cardRow, date: '2026-10-02', invoiceMonth: '2026-10' },
        { ...early, line: 3, value: 60000 },
        { ...early, line: 4, value: 50000 },
      ],
    });

    expect(result.errors.map((e) => [e.code, e.line])).toEqual([
      ['EARLY_PAYMENT_OVER_DUE', 3],
      ['EARLY_PAYMENT_OVER_DUE', 4],
    ]);
  });

  it.each([
    ['CARD_INCOME_CATEGORY', { ...refund, categoryId: 'cat-1' }],
    ['CARD_CREDIT_CATEGORY_MISUSED', { ...refund, accountId: 'acc-1', creditCardId: undefined }],
    ['INVOICE_MONTH_INVALID', { ...cardRow, invoiceMonth: '2026-13' }],
  ])('SHOULD report %s', async (code, row) => {
    const result = await setup.execute({ ...base, rows: [row] });

    expect(result.errors).toEqual([expect.objectContaining({ code, line: row.line })]);
  });

  it('SHOULD report PAID_FROM_ACCOUNT_INVALID for an archived account AND for another currency', async () => {
    const early = {
      ...refund,
      accountId: 'acc-1',
      categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT],
      date: '2026-10-16',
      invoiceMonth: '2026-10',
    };

    mocks.account.findAccountById.mockResolvedValueOnce({ ...mocks.account, status: 'ARCHIVED' });
    const archived = await setup.execute({ ...base, rows: [cardRow, early] });

    mocks.account.findAccountById.mockResolvedValueOnce({ currency: 'USD', status: 'ACTIVE' });
    const usd = await setup.execute({ ...base, rows: [cardRow, early] });

    expect(archived.errors.map((e) => e.code)).toContain('PAID_FROM_ACCOUNT_INVALID');
    expect(usd.errors.map((e) => e.code)).toContain('PAID_FROM_ACCOUNT_INVALID');
  });

  it('SHOULD give the card row the invoice of the file regardless of the date AND the computed one without it', async () => {
    await setup
      .execute({
        ...base,
        dryRun: false,
        rows: [
          { ...cardRow, date: '2026-10-01', invoiceMonth: '2026-08' },
          { ...cardRow, date: '2026-10-01', invoiceMonth: undefined, line: 3 },
          refund,
          { ...payment, invoiceMonth: undefined, line: 6, value: 1 },
        ],
      })
      .catch(() => undefined);

    const dry = await setup.execute({
      ...base,
      rows: [{ ...cardRow, date: '2026-10-01', invoiceMonth: undefined }, refund],
    });

    expect(dry.invoices.map((i) => i.invoiceMonth).sort()).toEqual(['2026-09', '2026-10']);
  });

  it('SHOULD take cards in a stable order in the repository call (lock order is by card id)', async () => {
    await setup.execute({ ...base, dryRun: false, rows: [cardRow, refund, discount, payment] });

    expect(mocks.cardCredit.createImportRows).toHaveBeenCalledTimes(1);
  });

  it('SHOULD flag a refund that repeats an existing one as duplicate WITHOUT an invoice error', async () => {
    mocks.transactionRepository.findDuplicateCandidates.mockResolvedValueOnce([
      {
        accountId: null,
        creditCardId: 'card-1',
        date: '2026-09-10',
        description: 'Estorno',
        type: TransactionType.INCOME,
        value: 1200,
      },
    ]);

    const result = await setup.execute({ ...base, rows: [refund] });

    expect(result.duplicates).toEqual([3]);
    expect(result.errors).toEqual([]);
  });

  describe('duplicates the user chose to import', () => {
    const early = {
      ...refund,
      categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT],
      date: '2026-10-02',
      description: 'Adiantamento',
      invoiceMonth: '2026-09',
      value: 30000,
    };
    const rows = [
      { ...cardRow, date: '2026-09-10' },
      { ...early, line: 3 },
      { ...early, line: 4 },
      { ...payment, line: 5, value: 40000 },
    ];

    it('SHOULD leave the repeated early payment out of the invoice WHEN it is not included', async () => {
      const result = await setup.execute({ ...base, rows });

      expect(result.duplicates).toContain(4);
      expect(result.errors.map((e) => [e.code, e.line])).toEqual([['INVOICE_PAYMENT_MISMATCH', 5]]);
    });

    it('SHOULD count it WHEN the user included it, and still report it as a duplicate', async () => {
      const result = await setup.execute({ ...base, includeDuplicates: [4], rows });

      expect(result.duplicates).toContain(4);
      expect(result.errors).toEqual([]);
      expect(result.invoices).toEqual([
        { amountDue: 40000, creditCardId: 'card-1', invoiceMonth: '2026-09', paid: true },
      ]);
    });
  });

  describe('notes (spec 059 FR 18)', () => {
    it.each([
      ['a refund', { ...refund }],
      ['a prepayment discount', { ...discount }],
      ['an early payment', { ...refund, categoryId: ID[SystemCategoryKey.CARD_EARLY_PAYMENT] }],
      ['an invoice payment', { ...payment }],
    ])('SHOULD refuse a note on %s with a row error', async (_name, row) => {
      const result = await setup.execute({
        ...base,
        rows: [cardRow, { ...row, notes: 'por quê' }],
      });

      expect(result.errors).toEqual([
        {
          code: 'NOTES_NOT_ALLOWED',
          line: row.line,
          message: 'Notes are only allowed on normal transactions',
        },
      ]);
    });

    it('SHOULD accept an empty note on a refund AND a note on a card purchase', async () => {
      const result = await setup.execute({
        ...base,
        rows: [
          { ...cardRow, notes: 'Presente' },
          { ...refund, notes: '   ' },
        ],
      });

      expect(result.errors).toEqual([]);
    });
  });
});

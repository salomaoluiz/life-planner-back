import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { TransactionType } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

const { base, validRow } = mocks;

describe('dry run', () => {
  it('SHOULD report no error and write nothing for valid rows', async () => {
    const result = await setup.execute({ ...base, rows: [validRow] });

    expect(result).toEqual({ created: 0, duplicates: [], errors: [] });
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

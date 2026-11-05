import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { TransactionController } from './transaction.controller';
import { mocks, setup } from './transaction.controller.mocks';

const validBody = {
  accountId: '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10',
  categoryId: '1d0f8a3b-5c6e-4f70-8a91-b2c3d4e5f607',
  date: '2026-10-03',
  description: 'Weekly groceries',
  owner: 'USER',
  ownerId: '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d',
  type: 'EXPENSE',
  value: 23490,
};

it('SHOULD be served at /finance/transactions under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, TransactionController)).toBe('finance/transactions');
  expect(Reflect.getMetadata(VERSION_METADATA, TransactionController)).toBe('1');
});

const month = { from: '2026-11-01', to: '2026-11-30' };

describe('findAll', () => {
  it('SHOULD list a period, or with repeated ownerId params, with the default limit', async () => {
    await setup.findAll(mocks.request, month);
    await setup.findAll(mocks.request, {
      ...month,
      ownerId: [validBody.ownerId, validBody.accountId],
    });

    expect(mocks.transactionService.findAll).toHaveBeenNthCalledWith(
      1,
      mocks.request.user.id,
      undefined,
      { filter: month, limit: 200 },
      undefined,
    );
    expect(mocks.transactionService.findAll).toHaveBeenNthCalledWith(
      2,
      mocks.request.user.id,
      [validBody.ownerId, validBody.accountId],
      { filter: month, limit: 200 },
      undefined,
    );
  });

  it('SHOULD forward the today query for the derived card status', async () => {
    await setup.findAll(mocks.request, { ...month, today: '2026-10-15' });

    expect(mocks.transactionService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      { filter: month, limit: 200 },
      '2026-10-15',
    );
  });

  it('SHOULD throw ValidationError WHEN an ownerId is not a uuid', async () => {
    await expect(setup.findAll(mocks.request, { ...month, ownerId: ['abc'] })).rejects.toThrow(
      ValidationError,
    );
  });

  it.each([
    ['no period', {}],
    ['only to', { to: '2026-11-30' }],
    ['CARD without invoiceMonth or period', { source: 'CARD' }],
    ['limit 0', { ...month, limit: '0' }],
    ['limit 501', { ...month, limit: '501' }],
    ['limit abc', { ...month, limit: 'abc' }],
    ['an invalid cursor', { ...month, cursor: 'garbage' }],
  ])('SHOULD throw ValidationError (400) WHEN the list has %s', async (_label, query) => {
    await expect(setup.findAll(mocks.request, query)).rejects.toThrow(ValidationError);
  });

  it('SHOULD accept source CARD with an invoiceMonth and no period', async () => {
    await setup.findAll(mocks.request, { invoiceMonth: '2026-11', source: 'CARD' });

    expect(mocks.transactionService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      { filter: undefined, invoiceMonth: '2026-11', limit: 200, source: 'CARD' },
      undefined,
    );
  });

  it('SHOULD forward limit and a valid cursor', async () => {
    const cursor = Buffer.from(
      '2026-11-03|2026-11-03T10:00:00.000Z|6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10',
    ).toString('base64');

    await setup.findAll(mocks.request, { ...month, cursor, limit: '50' });

    expect(mocks.transactionService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      { cursor, filter: month, limit: 50 },
      undefined,
    );
  });
});

describe('findAll filters (spec 045)', () => {
  const categoryId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
  const tagId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';

  it('SHOULD parse repeated ids, period, paid and search into one filter', async () => {
    await setup.findAll(mocks.request, {
      categoryId: [categoryId, tagId],
      from: '2025-01-01',
      paid: 'false',
      q: ' mercado ',
      tagId,
      to: '2025-12-31',
    });

    expect(mocks.transactionService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      {
        filter: {
          categoryIds: [categoryId, tagId],
          from: '2025-01-01',
          paid: false,
          q: 'mercado',
          tagIds: [tagId],
          to: '2025-12-31',
        },
        limit: 200,
      },
      undefined,
    );
  });

  it('SHOULD treat a whitespace-only search as no filter', async () => {
    await setup.findAll(mocks.request, { ...month, q: '   ' });

    expect(mocks.transactionService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      { filter: month, limit: 200 },
      undefined,
    );
  });

  it.each([
    ['only from', { from: '2025-01-01' }],
    ['only to', { to: '2025-01-01' }],
    ['to before from', { from: '2025-02-01', to: '2025-01-01' }],
    ['more than two years', { from: '2024-01-01', to: '2026-01-01' }],
    ['a search over 100 characters', { ...month, q: 'a'.repeat(101) }],
    ['a non-uuid category', { ...month, categoryId: 'abc' }],
    ['paid maybe', { ...month, paid: 'maybe' }],
  ])('SHOULD throw ValidationError (400) WHEN the query has %s', async (_label, query) => {
    await expect(setup.findAll(mocks.request, query)).rejects.toThrow(ValidationError);
  });

  it('SHOULD accept exactly two years', async () => {
    await setup.findAll(mocks.request, { from: '2024-01-01', to: '2025-12-31' });

    expect(mocks.transactionService.findAll).toHaveBeenCalled();
  });
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, validBody as never, {
      today: '2026-10-15',
    });

    expect(mocks.transactionService.create).toHaveBeenCalledWith(
      mocks.request.user.id,
      validBody,
      '2026-10-15',
    );
    expect(result).toEqual(mocks.transaction);
  });

  it.each([
    ['value 12.5', { value: 12.5 }],
    ['value 0', { value: 0 }],
    ['value -100', { value: -100 }],
    ['an impossible date', { date: '2026-02-30' }],
    ['an ISO timestamp date', { date: '2026-10-03T10:00:00Z' }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, patch) => {
    await expect(
      setup.create(mocks.request, { ...validBody, ...patch } as never, {}),
    ).rejects.toThrow(ValidationError);
    expect(mocks.transactionService.create).not.toHaveBeenCalled();
  });
});

describe('findById (spec 077)', () => {
  it('SHOULD forward the user, the id and the today query', async () => {
    const result = await setup.findById(mocks.request, mocks.transaction.id, {
      today: '2026-10-15',
    });

    expect(mocks.transactionService.findById).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
      '2026-10-15',
    );
    expect(result).toEqual(mocks.transaction);
  });

  it('SHOULD throw ValidationError WHEN today is not a calendar date', async () => {
    await expect(
      setup.findById(mocks.request, mocks.transaction.id, { today: 'nope' }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('update', () => {
  it('SHOULD forward a valid patch', async () => {
    await setup.update(mocks.request, mocks.transaction.id, { value: 100 } as never, {});

    expect(mocks.transactionService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
      { value: 100 },
      undefined,
    );
  });

  it('SHOULD throw ValidationError (400) WHEN the body is empty', async () => {
    await expect(
      setup.update(mocks.request, mocks.transaction.id, {} as never, {}),
    ).rejects.toThrow(ValidationError);
    expect(mocks.transactionService.update).not.toHaveBeenCalled();
  });
});

describe('confirm (spec 096)', () => {
  const body = { date: '2026-10-24', value: 9990 };

  it('SHOULD forward a valid body AND answer 200 at POST :id/confirm', async () => {
    await setup.confirm(mocks.request, mocks.transaction.id, body as never, {
      today: '2026-10-25',
    });

    expect(mocks.transactionService.confirm).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
      body,
      '2026-10-25',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, TransactionController.prototype.confirm)).toBe(
      200,
    );
    expect(Reflect.getMetadata(PATH_METADATA, TransactionController.prototype.confirm)).toBe(
      ':id/confirm',
    );
  });

  it.each([
    ['a missing value', { date: '2026-10-24' }],
    ['a bad date', { date: '24/10/2026', value: 1 }],
    ['an unknown field', { date: '2026-10-24', projected: false, value: 1 }],
  ])('SHOULD throw ValidationError (400) for %s', async (_, bad) => {
    await expect(
      setup.confirm(mocks.request, mocks.transaction.id, bad as never, {}),
    ).rejects.toThrow(ValidationError);
    expect(mocks.transactionService.confirm).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('SHOULD delete by id AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.transaction.id, {});

    expect(mocks.transactionService.delete).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
      undefined,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, TransactionController.prototype.delete)).toBe(
      204,
    );
  });
});

describe('delete scope (spec 034)', () => {
  it('SHOULD forward the scope of a recurring occurrence', async () => {
    await setup.delete(mocks.request, mocks.transaction.id, { scope: 'ONLY_THIS' });

    expect(mocks.transactionService.delete).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
      'ONLY_THIS',
    );
  });

  it('SHOULD reject an unknown scope', async () => {
    await expect(
      setup.delete(mocks.request, mocks.transaction.id, { scope: 'ALL' }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('card purchases (spec 029)', () => {
  const rest = { ...validBody, accountId: undefined };
  const cardId = '7c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

  it('SHOULD accept a body with creditCardId and no accountId', async () => {
    await setup.create(mocks.request, { ...rest, creditCardId: cardId } as never, {});

    expect(mocks.transactionService.create).toHaveBeenCalledWith(
      mocks.request.user.id,
      { ...rest, creditCardId: cardId },
      undefined,
    );
  });

  it.each([
    ['both sources', { ...rest, accountId: validBody.accountId, creditCardId: cardId }],
    ['neither source', rest],
  ])('SHOULD throw ValidationError (400) WHEN the create body has %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never, {})).rejects.toThrow(ValidationError);
  });

  it('SHOULD forward the CARD source filters AND reject a bad invoiceMonth', async () => {
    await setup.findAll(mocks.request, {
      creditCardId: cardId,
      invoiceMonth: '2026-10',
      source: 'CARD',
    });

    expect(mocks.transactionService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      {
        filter: { creditCardIds: [cardId] },
        invoiceMonth: '2026-10',
        limit: 200,
        source: 'CARD',
      },
      undefined,
    );
    await expect(
      setup.findAll(mocks.request, { ...month, invoiceMonth: '2026-13' }),
    ).rejects.toThrow(ValidationError);
  });

  it('SHOULD reject a patch with both sources', async () => {
    await expect(
      setup.update(
        mocks.request,
        mocks.transaction.id,
        { accountId: validBody.accountId, creditCardId: cardId } as never,
        {},
      ),
    ).rejects.toThrow(ValidationError);
  });
});

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD check consistency, then create the transaction with integer cents AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.input.accessibleOwners,
    accountId: mocks.input.accountId,
    blockArchivedAccount: true,
    categoryId: mocks.input.categoryId,
    creditCardId: undefined,
    owner: mocks.input.owner,
    ownerId: mocks.input.ownerId,
    type: mocks.input.type,
  });
  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith({
    accountId: mocks.input.accountId,
    categoryId: mocks.input.categoryId,
    creditCardId: undefined,
    date: '2026-10-03',
    description: 'Weekly groceries',
    invoiceMonth: undefined,
    owner: OwnerType.USER,
    ownerId: mocks.input.ownerId,
    paid: true,
    type: mocks.input.type,
    value: 23490,
  });
  expect(result).toEqual({ overLimit: false, transaction: mocks.transaction });
  expect(mocks.compute.execute).not.toHaveBeenCalled();
});

it('SHOULD trim the description AND accept the maximum value', async () => {
  await setup.execute({ ...mocks.input, description: '  Lunch ', value: INT4_MAX });

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Lunch', value: INT4_MAX }),
  );
});

it('SHOULD throw Forbidden (403) BEFORE any lookup WHEN the owner is not accessible', async () => {
  await expect(
    setup.execute({ ...mocks.input, owner: OwnerType.FAMILY, ownerId: 'pending-invite-family' }),
  ).rejects.toThrow(ForbiddenException);
  expect(mocks.ensureConsistency.execute).not.toHaveBeenCalled();
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it.each([
  ['NotFound (account / category missing)', new NotFoundException()],
  ['BadRequest (owner or type mismatch)', new BadRequestException()],
])('SHOULD create nothing WHEN the consistency check throws %s', async (_label, error) => {
  mocks.ensureConsistency.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toThrow(error);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it.each([
  ['a fractional value', { value: 12.5 }],
  ['zero', { value: 0 }],
  ['a negative value', { value: -100 }],
  ['a value above int4', { value: INT4_MAX + 1 }],
  ['a string value', { value: '100' }],
  ['an empty description', { description: '  ' }],
  ['a 201-character description', { description: 'a'.repeat(201) }],
  ['an impossible date', { date: '2026-02-30' }],
  ['month 13', { date: '2026-13-01' }],
  ['a date without zero padding', { date: '2026-10-3' }],
  ['an ISO timestamp', { date: '2026-10-03T10:00:00.000Z' }],
  ['a Date-like number', { date: 20261003 }],
  ['an unknown type', { type: 'TRANSFER' }],
])('SHOULD throw ValidationError WHEN the input has %s', async (_label, patch) => {
  await expect(setup.execute({ ...mocks.input, ...patch } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it('SHOULD accept a leap day', async () => {
  await setup.execute({ ...mocks.input, date: '2024-02-29' });

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2024-02-29' }),
  );
});

it('SHOULD propagate Unprocessable (422) WHEN the account is archived AND create nothing', async () => {
  mocks.ensureConsistency.execute.mockRejectedValueOnce(
    new UnprocessableEntityException('Account is archived'),
  );

  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

describe('card purchases (spec 029)', () => {
  function cardInput() {
    return {
      ...mocks.input,
      accountId: undefined,
      creditCardId: mocks.card.id,
      date: '2026-10-31',
    };
  }

  beforeEach(() => {
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });
  });

  it('SHOULD store the invoice month computed from the date AND the closing day', async () => {
    await setup.execute(cardInput());
    await setup.execute({ ...cardInput(), date: '2026-11-01' });
    await setup.execute({ ...cardInput(), date: '2026-12-03' });

    const months = mocks.transactionRepository.createTransaction.mock.calls.map(
      ([params]) => params.invoiceMonth,
    );

    expect(months).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: undefined, creditCardId: mocks.card.id }),
    );
  });

  it('SHOULD answer overLimit false WHEN the card used stays within the limit', async () => {
    expect((await setup.execute(cardInput())).overLimit).toBe(false);
  });

  it('SHOULD answer overLimit true (and still save) WHEN used passes the limit', async () => {
    mocks.compute.execute.mockResolvedValue([{ invoices: { used: 10_001 } }]);

    const result = await setup.execute(cardInput());

    expect(result.overLimit).toBe(true);
    expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['both accountId and creditCardId', { accountId: 'acc-1', creditCardId: 'card-1' }],
    ['neither', { accountId: undefined, creditCardId: undefined }],
  ])('SHOULD throw ValidationError WHEN the input has %s', async (_label, patch) => {
    await expect(setup.execute({ ...mocks.input, ...patch })).rejects.toThrow(ValidationError);
    expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD propagate the rejection of an INCOME on a card (400) and an archived card (422)', async () => {
    mocks.ensureConsistency.execute.mockRejectedValueOnce(new BadRequestException());
    await expect(setup.execute({ ...cardInput(), type: TransactionType.INCOME })).rejects.toThrow(
      BadRequestException,
    );

    mocks.ensureConsistency.execute.mockRejectedValueOnce(
      new UnprocessableEntityException('Credit card is archived'),
    );
    await expect(setup.execute(cardInput())).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
  });
});

describe('paid status (spec 033)', () => {
  it('SHOULD default paid to false WHEN the account row is dated after today', async () => {
    await setup.execute({ ...mocks.input, date: '2026-10-20' });

    expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ paid: false }),
    );
  });

  it('SHOULD keep an explicit paid AND default paid to true WHEN dated today', async () => {
    await setup.execute({ ...mocks.input, date: '2026-10-20', paid: true });
    await setup.execute({ ...mocks.input, date: '2026-10-15' });

    expect(mocks.transactionRepository.createTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ paid: true }),
    );
    expect(mocks.transactionRepository.createTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ paid: true }),
    );
  });

  it('SHOULD send no paid for a card purchase AND refuse one (422)', async () => {
    const card = { ...mocks.input, accountId: undefined, creditCardId: 'card-id' };

    await setup.execute(card);
    expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ paid: undefined }),
    );

    await expect(setup.execute({ ...card, paid: false })).rejects.toThrow(
      new UnprocessableEntityException('Card purchases follow their invoice'),
    );
  });
});

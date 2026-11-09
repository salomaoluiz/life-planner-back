import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD create a same-currency transfer with the amount in filled AND the in date defaulting to the out date', async () => {
  expect(await setup.execute(mocks.input)).toBe(mocks.transfer);

  expect(spies.transferRepository.createTransfer).toHaveBeenCalledWith(
    expect.objectContaining({
      amountIn: 100000,
      amountOut: 100000,
      createdBy: 'user-1',
      dateIn: '2026-11-04',
      fee: null,
      from: expect.objectContaining({ accountId: 'acc-from', currency: 'BRL' }),
      to: expect.objectContaining({ accountId: 'acc-to' }),
    }),
  );
});

it('SHOULD require the amount in for different currencies AND accept it with a fee', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValue([
    mocks.fromAccount,
    { ...mocks.toAccount, currency: 'USD' },
  ]);

  await expect(setup.execute(mocks.input)).rejects.toThrow('TRANSFER_AMOUNT_IN_REQUIRED');
  await setup.execute({ ...mocks.input, amountIn: 20000, dateIn: '2026-11-06', fee: 350 });

  expect(spies.transferRepository.createTransfer).toHaveBeenCalledWith(
    expect.objectContaining({ amountIn: 20000, dateIn: '2026-11-06', fee: 350 }),
  );
});

it.each([
  ['same account', { toAccountId: 'acc-from' }, 'TRANSFER_SAME_ACCOUNT'],
  ['different amounts in the same currency', { amountIn: 90000 }, 'TRANSFER_AMOUNT_MISMATCH'],
  ['an in date before the out date', { dateIn: '2026-11-03' }, 'TRANSFER_DATE_IN_BEFORE_OUT'],
])('SHOULD throw 422 %s AND write nothing', async (_label, patch, code) => {
  await expect(setup.execute({ ...mocks.input, ...patch })).rejects.toThrow(
    new UnprocessableEntityException(code),
  );
  expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
});

it('SHOULD allow an unpaid series occurrence of different currencies without the amount in', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValue([
    mocks.fromAccount,
    { ...mocks.toAccount, currency: 'USD' },
  ]);

  await setup.execute({
    ...mocks.input,
    occurrenceNumber: 2,
    paid: false,
    recurrenceId: 'series-1',
  });

  expect(spies.transferRepository.createTransfer).toHaveBeenCalledWith(
    expect.objectContaining({ amountIn: null, occurrenceNumber: 2, recurrenceId: 'series-1' }),
  );
});

it('SHOULD throw NotFound WHEN an account is missing or belongs to an owner the caller cannot access', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValueOnce([mocks.fromAccount]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  spies.accountRepository.findAccountsByIds.mockResolvedValueOnce([
    mocks.fromAccount,
    { ...mocks.toAccount, ownerId: 'stranger' },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
});

it('SHOULD throw 422 TRANSFER_ACCOUNT_ARCHIVED WHEN an account is archived AND 422 WHEN its family is archived', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValueOnce([
    mocks.fromAccount,
    { ...mocks.toAccount, status: AccountStatus.ARCHIVED },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow('TRANSFER_ACCOUNT_ARCHIVED');

  const archivedOwners = mocks.accessibleOwners.map((owner, index) =>
    index === 1 ? { ...owner, archived: true } : owner,
  );
  await expect(setup.execute({ ...mocks.input, accessibleOwners: archivedOwners })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
});

describe('recurrence (spec 098 FR 8)', () => {
  const monthly = { endDate: undefined, frequency: 'MONTHLY' as never };

  it('SHOULD create a monthly series whose only due occurrence is the first AND return that transfer', async () => {
    const result = await setup.execute({
      ...mocks.input,
      recurrence: monthly,
      today: '2026-11-09',
    });

    expect(result).toBe(mocks.transfer);
    expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
    expect(spies.transferRepository.createTransferSeries).toHaveBeenCalledWith({
      endDate: null,
      frequency: 'MONTHLY',
      lastGeneratedNumber: 1,
      nextOccurrenceDate: '2026-12-04',
      occurrences: [expect.objectContaining({ amountIn: 100000, occurrenceNumber: 1, paid: true })],
      status: 'ACTIVE',
    });
  });

  it('SHOULD number the occurrences due this month AND leave the later ones unpaid with the series amounts', async () => {
    await setup.execute({
      ...mocks.input,
      dateOut: '2026-11-02',
      fee: 500,
      recurrence: { frequency: 'WEEKLY' as never },
      today: '2026-11-09',
    });

    const { occurrences } = spies.transferRepository.createTransferSeries.mock.calls[0][0];
    expect(occurrences.map((item: { dateOut: string }) => item.dateOut)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
    expect(occurrences[0]).toMatchObject({ fee: 500, occurrenceNumber: 1, paid: true });
    expect(occurrences[1]).toMatchObject({
      amountIn: 100000,
      dateIn: '2026-11-09',
      fee: null,
      notes: null,
      occurrenceNumber: 2,
      paid: false,
    });
  });

  it('SHOULD give a different-currency series no amount in after the first occurrence', async () => {
    spies.accountRepository.findAccountsByIds.mockResolvedValue([
      mocks.fromAccount,
      { ...mocks.toAccount, currency: 'USD' },
    ]);

    await setup.execute({
      ...mocks.input,
      amountIn: 20000,
      dateOut: '2026-11-02',
      recurrence: { frequency: 'WEEKLY' as never },
      today: '2026-11-09',
    });

    const { occurrences } = spies.transferRepository.createTransferSeries.mock.calls[0][0];
    expect(occurrences[0].amountIn).toBe(20000);
    expect(occurrences[1].amountIn).toBeNull();
  });

  it('SHOULD reject an end date before the first date', async () => {
    await expect(
      setup.execute({
        ...mocks.input,
        recurrence: { endDate: '2026-11-01', frequency: 'MONTHLY' as never },
      }),
    ).rejects.toThrow();
    expect(spies.transferRepository.createTransferSeries).not.toHaveBeenCalled();
  });
});

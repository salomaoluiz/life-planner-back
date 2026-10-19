import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { day, mocks, setup } from './index.mocks';

const cardId = mocks.card.id;
const accountId = mocks.account.id;

// An open October invoice of 450,00 on the fixture card (closing 31, payment day 5): planned for 2026-11-05.
function invoiceData(card = mocks.card, amount = 45000, payments: object[] = []) {
  return [{ card, invoices: {}, payments, totals: [{ amount, invoiceMonth: '2026-10' }] }];
}

describe('GetDailyBalancesUseCase', () => {
  it('SHOULD take the paid rows of the month AND later ones back from the ledger for the opening', async () => {
    mocks.accountRepository.findPaidSumsFrom.mockResolvedValue([
      { accountId, amount: -5000, date: '2026-11-10' },
      { accountId, amount: -2000, date: '2027-01-10' },
    ]);

    const result = await setup.execute(mocks.input);

    expect(mocks.accountRepository.findPaidSumsFrom).toHaveBeenCalledWith({
      accountIds: [accountId],
      from: '2026-11-01',
    });
    expect(day(result.days, '2026-11-09').accounts[0].balance).toBe(77000);
    expect(day(result.days, '2026-11-10').accounts[0].balance).toBe(72000);
    expect(day(result.days, '2026-11-30').accounts[0].balance).toBe(72000);
  });

  it('SHOULD subtract overdue and add future unpaid rows from today / their date', async () => {
    mocks.accountRepository.findUnpaidSumsUntil.mockResolvedValue([
      { accountId, amount: -1000, date: '2026-10-03' },
      { accountId, amount: 5000, date: '2026-11-20' },
    ]);

    const result = await setup.execute(mocks.input);

    expect(mocks.accountRepository.findUnpaidSumsUntil).toHaveBeenCalledWith({
      accountIds: [accountId],
      to: '2026-11-30',
    });
    expect(day(result.days, '2026-11-01').accounts[0].balance).toBe(69000);
    expect(day(result.days, '2026-11-20').accounts[0].balance).toBe(74000);
    expect(day(result.days, '2026-11-20').projected).toBe(true);
  });

  it('SHOULD not read unpaid rows, invoices or projections for a month fully in the past', async () => {
    const result = await setup.execute({ ...mocks.input, month: '2026-08' });

    expect(mocks.accountRepository.findUnpaidSumsUntil).not.toHaveBeenCalled();
    expect(mocks.compute.execute).not.toHaveBeenCalled();
    expect(mocks.projections.execute).not.toHaveBeenCalled();
    expect(result.days).toHaveLength(31);
  });

  it('SHOULD project only for months after today’s month AND count account occurrences', async () => {
    await setup.execute({ ...mocks.input, month: '2026-10' });
    expect(mocks.projections.execute).not.toHaveBeenCalled();

    mocks.projections.execute.mockResolvedValue([
      {
        account: { icon: 'bank', id: accountId, name: 'Checking' },
        creditCard: null,
        date: '2026-11-25',
        invoiceMonth: null,
        type: 'EXPENSE',
        value: 200000,
      },
    ]);

    const result = await setup.execute(mocks.input);

    expect(mocks.projections.execute).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-11', to: '2026-11', today: '2026-10-20' }),
    );
    expect(day(result.days, '2026-11-24').accounts[0].balance).toBe(70000);
    expect(day(result.days, '2026-11-25').accounts[0].balance).toBe(-130000);
  });

  it('SHOULD put an unlinked invoice due in cardsDue on its planned payment day', async () => {
    mocks.creditCardRepository.findCreditCards.mockResolvedValue([mocks.card]);
    mocks.compute.execute.mockResolvedValue(invoiceData());

    const result = await setup.execute(mocks.input);

    expect(day(result.days, '2026-11-04').cardsDue).toBe(0);
    expect(day(result.days, '2026-11-05').cardsDue).toBe(-45000);
    expect(day(result.days, '2026-11-05').total).toBe(70000 - 45000);
    expect(day(result.days, '2026-11-05').accounts[0].balance).toBe(70000);
  });

  it('SHOULD add projected card occurrences to their invoice', async () => {
    mocks.creditCardRepository.findCreditCards.mockResolvedValue([mocks.card]);
    mocks.compute.execute.mockResolvedValue(invoiceData());
    mocks.projections.execute.mockResolvedValue([
      {
        account: null,
        creditCard: { id: cardId },
        date: '2026-11-20',
        invoiceMonth: '2026-10',
        type: 'EXPENSE',
        value: 1000,
      },
    ]);

    const result = await setup.execute(mocks.input);

    expect(day(result.days, '2026-11-05').cardsDue).toBe(-46000);
  });

  it('SHOULD lower the linked account instead of cardsDue WHEN it is an included account', async () => {
    const linked = { ...mocks.card, paymentAccountId: accountId };
    mocks.creditCardRepository.findCreditCards.mockResolvedValue([linked]);
    mocks.compute.execute.mockResolvedValue(invoiceData(linked));

    const result = await setup.execute(mocks.input);

    expect(day(result.days, '2026-11-05').accounts[0].balance).toBe(25000);
    expect(day(result.days, '2026-11-05').cardsDue).toBe(0);
    expect(day(result.days, '2026-11-05').total).toBe(25000);
  });

  it('SHOULD fall back to cardsDue WHEN the linked account is archived or outside the scope', async () => {
    const linked = { ...mocks.card, paymentAccountId: 'other-account' };
    mocks.creditCardRepository.findCreditCards.mockResolvedValue([linked]);
    mocks.compute.execute.mockResolvedValue(invoiceData(linked));

    const result = await setup.execute(mocks.input);

    expect(day(result.days, '2026-11-05').cardsDue).toBe(-45000);
  });

  it('SHOULD ignore an invoice with a payment record AND one whose credits leave nothing to pay', async () => {
    mocks.creditCardRepository.findCreditCards.mockResolvedValue([mocks.card]);
    mocks.compute.execute.mockResolvedValue(
      invoiceData(mocks.card, 45000, [
        {
          accountId: null,
          accountName: null,
          amount: 45000,
          method: 'EXTERNAL',
          paidOn: '2026-10-25',
          referenceMonth: '2026-10',
        },
      ]),
    );

    expect(day((await setup.execute(mocks.input)).days, '2026-11-05').cardsDue).toBe(0);

    mocks.compute.execute.mockResolvedValue(invoiceData(mocks.card, -3000));

    expect(day((await setup.execute(mocks.input)).days, '2026-11-05').cardsDue).toBe(0);
  });

  it('SHOULD count an archived card AND leave archived accounts out', async () => {
    const archivedCard = { ...mocks.card, status: 'ARCHIVED' };
    mocks.creditCardRepository.findCreditCards.mockResolvedValue([archivedCard]);
    mocks.compute.execute.mockResolvedValue(invoiceData(archivedCard as never));
    mocks.accountRepository.findAccounts.mockResolvedValue([
      mocks.account,
      { ...mocks.account, id: 'archived', status: 'ARCHIVED' },
    ]);

    const result = await setup.execute(mocks.input);

    expect(result.accounts.map((account) => account.id)).toEqual([accountId]);
    expect(day(result.days, '2026-11-05').cardsDue).toBe(-45000);
  });

  it('SHOULD reject an ownerId the caller cannot access AND a month more than 12 ahead', async () => {
    await expect(setup.execute({ ...mocks.input, ownerIds: ['stranger'] })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(setup.execute({ ...mocks.input, month: '2027-11' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(setup.execute({ ...mocks.input, month: '2027-10' })).resolves.toBeDefined();
  });

  it('SHOULD return zeros WHEN there are no accounts', async () => {
    mocks.accountRepository.findAccounts.mockResolvedValue([]);

    const result = await setup.execute(mocks.input);

    expect(result.accounts).toEqual([]);
    expect(day(result.days, '2026-11-01').total).toBe(0);
  });
});

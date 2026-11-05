import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('ConfirmProjectedTransactionUseCase', () => {
  it('SHOULD turn the row effective with the real value and date, on the invoice of that date', async () => {
    const result = await setup.execute(mocks.input);

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith({
      date: '2026-10-24',
      id: mocks.input.id,
      invoiceMonth: '2026-11',
      projected: false,
      value: 9990,
    });
    expect(result).toEqual({
      invoiceData: [{ invoices: { projectedUsed: 0, used: 5000 } }],
      overLimit: false,
      transaction: mocks.confirmed,
    });
  });

  it('SHOULD answer 409 Transaction is not projected for an effective row AND write nothing', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue({
      ...mocks.projected,
      projected: false,
    });

    await expect(setup.execute(mocks.input)).rejects.toThrow(
      new ConflictException('Transaction is not projected'),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the row is missing OR its owner is not accessible', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(undefined);

    await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
    await expect(
      setup.execute({
        ...mocks.input,
        accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'someone-else' }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SHOULD keep a chosen invoice of the 095 options AND refuse any other month', async () => {
    await setup.execute({ ...mocks.input, invoiceMonth: '2026-10' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2026-10' }),
    );
    await expect(setup.execute({ ...mocks.input, invoiceMonth: '2027-03' })).rejects.toThrow(
      new UnprocessableEntityException('Invoice is not available for this date'),
    );
  });

  it('SHOULD confirm only this occurrence of a series (no series write)', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue({
      ...mocks.projected,
      occurrenceNumber: 4,
      recurrenceId: 'series-1',
    });

    await setup.execute(mocks.input);

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledTimes(1);
    expect(Object.keys(mocks.transactionRepository.updateTransaction.mock.calls[0][0])).toEqual(
      expect.not.arrayContaining(['recurrenceId', 'scope']),
    );
  });

  it('SHOULD flag overLimit WHEN the confirmed purchase leaves the card above the limit', async () => {
    mocks.compute.execute.mockResolvedValue([{ invoices: { projectedUsed: 6000, used: 5000 } }]);

    expect((await setup.execute(mocks.input)).overLimit).toBe(true);
  });

  it('SHOULD refuse a card that is no longer there (the row left the card)', async () => {
    mocks.ensureConsistency.execute.mockResolvedValue({});

    await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
  });
});

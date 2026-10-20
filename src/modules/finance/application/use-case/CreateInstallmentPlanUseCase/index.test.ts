import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { TransactionType } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD split the total, put installment k on invoice + (k - 1) AND return the plan (closing day 31, 10x)', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      blockArchivedAccount: true,
      creditCardId: mocks.card.id,
      type: TransactionType.EXPENSE,
    }),
  );
  const call = mocks.planRepository.createPlan.mock.calls[0][0];

  expect(call.values).toEqual(Array(10).fill(51200));
  expect(call.months[0]).toBe('2026-10');
  expect(call.months[9]).toBe('2027-07');
  expect(result).toEqual({ installments: [], overLimit: true, plan: { id: 'plan-1' } });
});

it('SHOULD start on the NEXT invoice WHEN the purchase is after the closing day', async () => {
  mocks.ensureConsistency.execute.mockResolvedValueOnce({ card: { ...mocks.card, closingDay: 5 } });

  await setup.execute({ ...mocks.input, date: '2026-10-06', installments: 2, value: 101 });

  const call = mocks.planRepository.createPlan.mock.calls[0][0];

  expect(call.months).toEqual(['2026-11', '2026-12']);
  expect(call.values).toEqual([51, 50]);
});

it('SHOULD report overLimit false WHEN the card has room', async () => {
  mocks.compute.execute.mockResolvedValueOnce([{ invoices: { used: 1000 } }]);

  expect((await setup.execute(mocks.input)).overLimit).toBe(false);
});

it.each([1, 49])('SHOULD reject %d installments and write nothing', async (installments) => {
  await expect(setup.execute({ ...mocks.input, installments })).rejects.toThrow(ValidationError);
  expect(mocks.planRepository.createPlan).not.toHaveBeenCalled();
});

it('SHOULD reject a total smaller than the number of installments', async () => {
  await expect(setup.execute({ ...mocks.input, installments: 10, value: 5 })).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.planRepository.createPlan).not.toHaveBeenCalled();
});

it('SHOULD refuse an owner the caller cannot access', async () => {
  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    ForbiddenException,
  );
});

it('SHOULD let the archived card / paid invoice errors through', async () => {
  mocks.ensureConsistency.execute.mockRejectedValueOnce(new UnprocessableEntityException());
  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);

  mocks.planRepository.createPlan.mockRejectedValueOnce(new UnprocessableEntityException());
  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.getPlan.execute).not.toHaveBeenCalled();
});

describe('currency (spec 040)', () => {
  it('SHOULD create the plan in the currency of the card AND check a sent currency against it', async () => {
    mocks.ensureConsistency.execute.mockResolvedValueOnce({
      card: { ...mocks.card, currency: 'USD' },
    });

    await setup.execute({ ...mocks.input, currency: 'USD' });

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
    expect(mocks.planRepository.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = mocks.input;
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});

it('SHOULD pass the tag names to the plan creation (spec 043 FR 10)', async () => {
  await setup.execute({ ...mocks.input, tags: ['viagem'] });

  expect(mocks.planRepository.createPlan).toHaveBeenCalledWith(
    expect.objectContaining({ tags: ['viagem'] }),
  );
});

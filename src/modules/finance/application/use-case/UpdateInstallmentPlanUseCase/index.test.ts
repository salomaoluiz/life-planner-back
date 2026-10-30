import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

describe('text-only edits (no recalculation)', () => {
  it('SHOULD rename the plan WITHOUT recreating rows', async () => {
    const result = await setup.execute({ ...mocks.input, description: 'Laptop' });

    expect(mocks.planRepository.updatePlanText).toHaveBeenCalledWith({
      categoryId: undefined,
      description: 'Laptop',
      id: mocks.plan.id,
    });
    expect(mocks.planRepository.recreatePlan).not.toHaveBeenCalled();
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ blockArchivedAccount: false }),
    );
    expect(result.overLimit).toBe(false);
  });

  it('SHOULD NOT recalculate WHEN total, count, card and date are sent unchanged (keeps per-installment adjustments)', async () => {
    await setup.execute({
      ...mocks.input,
      creditCardId: mocks.plan.creditCardId,
      date: mocks.plan.date,
      description: 'Laptop',
      installments: 3,
      value: 10000,
    });

    expect(mocks.planRepository.recreatePlan).not.toHaveBeenCalled();
    expect(mocks.planRepository.updatePlanText).toHaveBeenCalledTimes(1);
  });
});

describe('structural edits', () => {
  it('SHOULD re-split a new total over a new count AND recreate the rows', async () => {
    await setup.execute({ ...mocks.input, installments: 12, value: 12000 });

    expect(mocks.planRepository.recreatePlan).toHaveBeenCalledWith({
      categoryId: mocks.plan.categoryId,
      creditCardId: mocks.card.id,
      date: '2026-10-20',
      description: 'Notebook',
      id: mocks.plan.id,
      months: expect.arrayContaining(['2026-10', '2027-09']),
      notes: null,
      values: Array(12).fill(1000),
    });
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ blockArchivedAccount: true }),
    );
    expect(mocks.planRepository.updatePlanText).not.toHaveBeenCalled();
  });

  it('SHOULD use the current SUM as the total WHEN only the count changes', async () => {
    await setup.execute({ ...mocks.input, installments: 4 });

    expect(mocks.planRepository.recreatePlan.mock.calls[0][0].values).toEqual([
      2500, 2500, 2500, 2500,
    ]);
  });

  it('SHOULD answer 400 WHEN the total is smaller than the count', async () => {
    await expect(setup.execute({ ...mocks.input, installments: 48, value: 20 })).rejects.toThrow(
      BadRequestException,
    );
    expect(mocks.planRepository.recreatePlan).not.toHaveBeenCalled();
  });
});

it('SHOULD answer 404 WHEN the plan is missing or not accessible', async () => {
  mocks.planRepository.findPlanById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...mocks.input, description: 'x' })).rejects.toThrow(
    NotFoundException,
  );

  await expect(
    setup.execute({ ...mocks.input, accessibleOwners: [], description: 'x' }),
  ).rejects.toThrow(NotFoundException);
});

it('SHOULD require at least one field', async () => {
  await expect(setup.execute(mocks.input)).rejects.toThrow(ValidationError);
});

describe('after a prepayment (spec 032 FR 18)', () => {
  beforeEach(() => {
    mocks.planRepository.findPlanById.mockResolvedValue({
      ...mocks.plan,
      prepayment: {
        date: '2026-10-16',
        discount: 0,
        id: 'prepayment-1',
        targetInvoiceMonth: '2026-10',
      },
    });
  });

  it('SHOULD answer 422 for a structural change AND write nothing', async () => {
    await expect(setup.execute({ ...mocks.input, value: 20000 })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.planRepository.recreatePlan).not.toHaveBeenCalled();
  });

  it('SHOULD still accept description and category', async () => {
    await setup.execute({ ...mocks.input, description: 'Laptop' });

    expect(mocks.planRepository.updatePlanText).toHaveBeenCalledTimes(1);
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { ...mocks.input, description: 'Laptop' };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});

describe('tags (spec 043)', () => {
  it('SHOULD pass the names to the text-only update AND count as a field', async () => {
    await setup.execute({ ...mocks.input, tags: ['fixo'] });

    expect(mocks.planRepository.updatePlanText).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['fixo'] }),
    );
  });

  it('SHOULD pass the names to a recreate (undefined keeps the old tags)', async () => {
    await setup.execute({ ...mocks.input, installments: 12, tags: [], value: 12000 });

    expect(mocks.planRepository.recreatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] }),
    );
  });
});

describe('notes (spec 059)', () => {
  it('SHOULD send the new notes to a text edit AND keep the plan notes on a structural recreate', async () => {
    await setup.execute({ ...mocks.input, notes: 'Black Friday' });
    expect(mocks.planRepository.updatePlanText).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Black Friday' }),
    );

    await setup.execute({ ...mocks.input, installments: 12, value: 12000 });
    expect(mocks.planRepository.recreatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ notes: mocks.plan.notes }),
    );
  });
});

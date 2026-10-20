import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('recurrences', () => {
  it('SHOULD list an active recurrence of a descendant with that descendant category id', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      mocks.recurrence({ categoryId: 'c2' }),
      mocks.recurrence({ categoryId: 'unrelated', id: 'rec-2' }),
    ]);

    const result = await setup.execute(mocks.input);

    expect(mocks.recurrenceRepository.findByOwners).toHaveBeenCalledWith(mocks.input.scopes, {
      status: 'ACTIVE',
    });
    expect(result.recurrences).toEqual([
      { categoryId: 'c2', description: 'Gym', id: 'rec-1', nextOccurrenceDate: '2026-11-05' },
    ]);
  });

  it('SHOULD only count (hiddenCount) a recurrence of a scope the caller cannot see', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      mocks.recurrence({ owner: OwnerType.FAMILY, ownerId: mocks.otherId }),
    ]);

    const result = await setup.execute(mocks.input);

    expect(result).toEqual({ hiddenCount: 1, installmentPlans: [], recurrences: [] });
  });
});

describe('installment plans', () => {
  it('SHOULD list a plan with installments after the current invoice month (closing day 10, today 2026-10-20 = invoice 2026-11)', async () => {
    mocks.planRepository.findPlansByCategoryIds.mockResolvedValue([
      mocks.plan(['2026-10', '2026-11', '2026-12', '2027-02']),
    ]);

    const result = await setup.execute(mocks.input);

    expect(mocks.planRepository.findPlansByCategoryIds).toHaveBeenCalledWith(['c1', 'c2']);
    expect(result.installmentPlans).toEqual([
      {
        categoryId: 'c1',
        description: 'TV',
        id: 'plan-1',
        lastInvoiceMonth: '2027-02',
        remainingInstallments: 2,
      },
    ]);
  });

  it('SHOULD NOT list a plan whose last installment is on or before the current invoice month', async () => {
    mocks.planRepository.findPlansByCategoryIds.mockResolvedValue([
      mocks.plan(['2026-09', '2026-10', '2026-11']),
    ]);

    expect((await setup.execute(mocks.input)).installmentPlans).toEqual([]);
  });

  it('SHOULD count (hiddenCount) a pending plan of an owner the caller cannot see', async () => {
    mocks.planRepository.findPlansByCategoryIds.mockResolvedValue([
      mocks.plan(['2027-01'], { owner: OwnerType.FAMILY, ownerId: mocks.otherId }),
    ]);

    const result = await setup.execute(mocks.input);

    expect(result.hiddenCount).toBe(1);
    expect(result.installmentPlans).toEqual([]);
  });
});

it('SHOULD return empty lists and hiddenCount 0 WHEN nothing is pending', async () => {
  expect(await setup.execute(mocks.input)).toEqual({
    hiddenCount: 0,
    installmentPlans: [],
    recurrences: [],
  });
});

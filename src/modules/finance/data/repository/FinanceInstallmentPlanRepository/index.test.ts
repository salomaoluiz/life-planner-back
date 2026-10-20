import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('createPlan / recreatePlan', () => {
  it('SHOULD zip months and values into rows AND turn the date into a UTC-midnight Date', async () => {
    const id = await setup.createPlan({
      categoryId: 'cat-1',
      creditCardId: 'card-1',
      currency: 'BRL' as const,
      date: '2026-10-20',
      description: 'Notebook',
      months: ['2026-10', '2026-11'],
      owner: OwnerType.USER,
      ownerId: 'owner-1',
      values: [5, 4],
    });

    expect(id).toBe('plan-1');
    expect(mocks.planDatasource.create).toHaveBeenCalledWith({
      category_id: 'cat-1',
      credit_card_id: 'card-1',
      currency: 'BRL' as const,
      date: new Date('2026-10-20T00:00:00.000Z'),
      description: 'Notebook',
      owner: 'USER',
      owner_id: 'owner-1',
      rows: [
        { invoice_month: '2026-10', value: 5 },
        { invoice_month: '2026-11', value: 4 },
      ],
    });
  });

  it('SHOULD delegate the recreate with column names', async () => {
    await setup.recreatePlan({
      categoryId: 'cat-1',
      creditCardId: 'card-1',
      date: '2026-10-20',
      description: 'Notebook',
      id: 'plan-1',
      months: ['2026-10'],
      values: [9],
    });

    expect(mocks.planDatasource.recreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plan-1', rows: [{ invoice_month: '2026-10', value: 9 }] }),
    );
  });
});

describe('deletePlan / findPlanById', () => {
  it('SHOULD delete by id', async () => {
    await setup.deletePlan('plan-1');

    expect(mocks.planDatasource.delete).toHaveBeenCalledWith('plan-1');
  });

  it('SHOULD map the found plan', async () => {
    expect(await setup.findPlanById('plan-1')).toEqual({ id: 'plan-1' });
    expect(spies.mapper).toHaveBeenCalledWith({ id: 'plan-1' });
  });

  it('SHOULD return undefined WHEN there is no plan', async () => {
    mocks.planDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.findPlanById('x')).toBeUndefined();
  });
});

describe('findPlansByCategoryIds', () => {
  it('SHOULD map each plan with the closing day of its card', async () => {
    expect(await setup.findPlansByCategoryIds(['cat-1'])).toEqual([
      { closingDay: 9, plan: { id: 'plan-1' } },
    ]);
    expect(mocks.planDatasource.findManyByCategoryIds).toHaveBeenCalledWith(['cat-1']);
  });
});

describe('findPlansByOwners', () => {
  it('SHOULD map each plan with the closing day of its card', async () => {
    const owners = [{ owner: 'FAMILY' as never, ownerId: 'family-1' }];

    expect(await setup.findPlansByOwners(owners)).toEqual([
      { closingDay: 9, plan: { id: 'plan-1' } },
    ]);
    expect(mocks.planDatasource.findManyByOwners).toHaveBeenCalledWith(owners);
  });
});

describe('updates', () => {
  it('SHOULD translate updateFromNumber', async () => {
    await setup.updateFromNumber({ fromNumber: 4, planId: 'plan-1', value: 7 });

    expect(mocks.planDatasource.updateFromNumber).toHaveBeenCalledWith({
      category_id: undefined,
      description: undefined,
      from_number: 4,
      plan_id: 'plan-1',
      value: 7,
    });
  });

  it('SHOULD translate updatePlanText', async () => {
    await setup.updatePlanText({ categoryId: 'cat-2', id: 'plan-1' });

    expect(mocks.planDatasource.updateText).toHaveBeenCalledWith({
      category_id: 'cat-2',
      description: undefined,
      id: 'plan-1',
    });
  });
});

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './installment-plan.service.mocks';

const body = {
  categoryId: mocks.plan.categoryId,
  creditCardId: mocks.plan.creditCardId,
  date: '2026-10-20',
  description: 'Notebook',
  installments: 3,
  owner: OwnerType.USER,
  ownerId: mocks.userId,
  value: 10000,
};

it('SHOULD create with the accessible owners AND the body today over the query today', async () => {
  const result = await setup.create(mocks.userId, { ...body, today: '2026-10-16' }, '2026-10-17');

  expect(mocks.create.execute).toHaveBeenCalledWith({
    ...body,
    accessibleOwners: mocks.accessibleOwners,
    today: '2026-10-16',
  });
  expect(result).toEqual({
    installments: mocks.details.installments,
    overLimit: false,
    plan: expect.objectContaining({
      id: mocks.plan.id,
      installmentCount: 3,
      totalValue: mocks.plan.totalValue,
    }),
  });
});

it('SHOULD fall back to the query today, then to the server date', async () => {
  await setup.create(mocks.userId, body, '2026-10-17');
  await setup.create(mocks.userId, body);

  expect(mocks.create.execute.mock.calls[0][0].today).toBe('2026-10-17');
  expect(mocks.create.execute.mock.calls[1][0].today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('SHOULD read one plan', async () => {
  const result = await setup.findOne(mocks.userId, mocks.plan.id, '2026-10-17');

  expect(mocks.get.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.plan.id,
    today: '2026-10-17',
  });
  expect(result.overLimit).toBeUndefined();
});

it('SHOULD update through the use case', async () => {
  await setup.update(mocks.userId, mocks.plan.id, { description: 'Laptop' }, '2026-10-17');

  expect(mocks.update.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    description: 'Laptop',
    id: mocks.plan.id,
    today: '2026-10-17',
  });
});

it('SHOULD delete through the use case', async () => {
  await setup.delete(mocks.userId, mocks.plan.id);

  expect(mocks.delete.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.plan.id,
  });
});

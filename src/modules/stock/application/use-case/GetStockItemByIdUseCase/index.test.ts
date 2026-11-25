import { NotFoundException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { item } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

it('SHOULD return the item view with its lots', async () => {
  const view = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'item' });

  expect(view.quantity).toBe(2);
  expect(view.lots).toHaveLength(1);
  expect(mocks.stock.findById).toHaveBeenCalledWith('item');
});

it.each([
  ['missing', undefined],
  ['of another owner', item([], (f) => f.withOwnerId('other'))],
])('SHOULD answer 404 WHEN the item is %s', async (_label, found) => {
  mocks.stock.findById.mockResolvedValue(found);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'item' }),
  ).rejects.toThrow(NotFoundException);
});

it('SHOULD throw ValidationError WHEN the id is empty', async () => {
  await expect(setup.execute({ accessibleOwners: mocks.accessibleOwners, id: '' })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD add the 90-day waste of the item (spec 123 FR 32)', async () => {
  mocks.stock.findById.mockResolvedValue(item());
  mocks.stock.findWasteRows.mockResolvedValue([
    { count: 1, currency: 'BRL', quantity: 2, reason: 'EXPIRED', valueCents: 978 },
  ]);

  const view = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: 'item',
    today: '2026-11-25',
  });

  expect(view.waste90d).toEqual({
    count: 1,
    mainReason: 'EXPIRED',
    quantity: 2,
    totals: [{ currency: 'BRL', valueCents: 978 }],
  });
  expect(mocks.stock.findWasteRows).toHaveBeenCalledWith(
    'item',
    new Date('2026-08-27T00:00:00.000Z'),
  );
});

it('SHOULD have no waste WHEN nothing was discarded', async () => {
  mocks.stock.findById.mockResolvedValue(item());
  mocks.stock.findWasteRows.mockResolvedValue([]);

  const view = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'item' });

  expect(view.waste90d).toBeNull();
});

import { ConflictException } from '@nestjs/common';

import { purchase } from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { base, mocks, setup } from './index.mocks';

const now = new Date('2026-11-18T12:00:00.000Z');

it('SHOULD take the lock AND renew it for the same closer', async () => {
  const result = await setup.execute({ ...base, now });

  expect(result).toEqual({ closingAt: now, closingBy: 'user-id' });

  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: new Date(now.getTime() - 60_000), closingBy: 'user-id' }),
  );
  await setup.execute({ ...base, now });
  expect(mocks.purchases.setClosing).toHaveBeenCalledTimes(2);
});

it('SHOULD answer 409 with the closer WHEN another member holds a valid lock', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: new Date(now.getTime() - 60_000), closingBy: 'other' }),
  );

  await expect(setup.execute({ ...base, now })).rejects.toMatchObject({
    response: { by: { id: 'other' }, code: 'PURCHASE_CLOSING' },
  });
});

it('SHOULD take over an expired lock (15 minutes)', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', {
      closingAt: new Date(now.getTime() - 16 * 60_000),
      closingBy: 'other',
    }),
  );

  await expect(setup.execute({ ...base, now })).resolves.toMatchObject({ closingBy: 'user-id' });
});

it('SHOULD release only the own lock', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: now, closingBy: 'user-id' }),
  );
  await setup.execute({ ...base, now, release: true });
  expect(mocks.purchases.setClosing).toHaveBeenCalledWith('purchase-id', null, now);

  mocks.purchases.setClosing.mockClear();
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: now, closingBy: 'other' }),
  );
  await setup.execute({ ...base, now, release: true });
  expect(mocks.purchases.setClosing).not.toHaveBeenCalled();
});

it('SHOULD refuse (409) a purchase that is not open or ended', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { status: PurchaseStatuses.CLOSED }),
  );

  await expect(setup.execute({ ...base, now })).rejects.toThrow(ConflictException);
});

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD read the expiring lots of every owner in ONE repository call', async () => {
  const lots = [{ lotId: 'lot-1' }];
  mocks.stockRepository.findExpiringLots.mockResolvedValue(lots);

  expect(await setup.execute({ owners: mocks.owners, today: '2026-11-23' })).toBe(lots);
  expect(mocks.stockRepository.findExpiringLots).toHaveBeenCalledTimes(1);
  expect(mocks.stockRepository.findExpiringLots).toHaveBeenCalledWith(mocks.owners, '2026-11-23');
});

it('SHOULD answer [] WITHOUT querying WHEN there are no owners', async () => {
  expect(await setup.execute({ owners: [], today: '2026-11-23' })).toEqual([]);
  expect(mocks.stockRepository.findExpiringLots).not.toHaveBeenCalled();
});

it('SHOULD reject a date that is not YYYY-MM-DD', async () => {
  await expect(setup.execute({ owners: mocks.owners, today: '23/11/2026' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

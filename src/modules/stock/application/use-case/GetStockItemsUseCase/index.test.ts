import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD query every accessible owner in one repository call', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.stockRepository.findByOwners).toHaveBeenCalledTimes(1);
  expect(mocks.stockRepository.findByOwners).toHaveBeenCalledWith(mocks.accessibleOwners);
});

it('SHOULD sort by expiration ascending (nulls last), then description case-insensitive, then id', async () => {
  const noDateB = mocks.item('banana', 'b');
  const noDateA = mocks.item('Apple', 'z');
  const late = mocks.item('zucchini', 'c', '2027-01-01T00:00:00.000Z');
  const soonB = mocks.item('Beta', 'd', '2026-10-20T00:00:00.000Z');
  const soonA = mocks.item('alpha', 'e', '2026-10-20T00:00:00.000Z');
  const twinB = mocks.item('same', 'y');
  const twinA = mocks.item('SAME', 'x');
  mocks.stockRepository.findByOwners.mockResolvedValueOnce([
    noDateB,
    late,
    twinB,
    noDateA,
    soonB,
    twinA,
    soonA,
  ]);

  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(result.map((entity) => entity.id)).toEqual(['e', 'd', 'c', 'z', 'b', 'x', 'y']);
});

it('SHOULD narrow to one owner WHEN ownerId is given', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerId: mocks.familyId });

  expect(mocks.stockRepository.findByOwners).toHaveBeenCalledWith([mocks.accessibleOwners[1]]);
});

it('SHOULD return [] WITHOUT touching the repository WHEN the ownerId is not accessible', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerId: 'x' });

  expect(result).toEqual([]);
  expect(mocks.stockRepository.findByOwners).not.toHaveBeenCalled();
});

it('SHOULD throw ValidationError WHEN the input is malformed', async () => {
  await expect(setup.execute({ accessibleOwners: 'nope' } as never)).rejects.toThrow(
    ValidationError,
  );
});

import { mocks, setup } from './index.mocks';

it('SHOULD list the markets of the owners without archived families (all)', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.archivedOwners });

  expect(result).toHaveLength(1);
  expect(mocks.markets.findByOwners).toHaveBeenCalledWith(
    [{ owner: 'USER', ownerId: 'user-id' }],
    false,
  );
});

it('SHOULD narrow to an owner AND answer nothing for one the caller cannot reach', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    includeArchived: true,
    ownerId: 'family-id',
  });
  expect(mocks.markets.findByOwners).toHaveBeenCalledWith(
    [{ owner: 'FAMILY', ownerId: 'family-id' }],
    true,
  );

  mocks.markets.findByOwners.mockClear();
  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerId: 'x' })).toEqual(
    [],
  );
  expect(mocks.markets.findByOwners).not.toHaveBeenCalled();
});

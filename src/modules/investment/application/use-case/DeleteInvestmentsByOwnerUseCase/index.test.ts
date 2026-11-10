import { setup, spies } from './index.mocks';

it('SHOULD delete the assets of the owner AND return how many', async () => {
  spies.deleteAssetsByOwner.mockResolvedValue(2);

  expect(await setup.execute({ owner: 'USER' as never, ownerId: 'user-1' })).toBe(2);
  expect(spies.deleteAssetsByOwner).toHaveBeenCalledWith({ owner: 'USER', ownerId: 'user-1' });
});

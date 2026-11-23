import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { base, mocks, setup } from './index.mocks';

it('SHOULD create the market of the owner', async () => {
  await setup.execute({ ...base, neighborhood: 'Centro' });

  expect(mocks.markets.create).toHaveBeenCalledWith({
    name: 'Bom Preço',
    neighborhood: 'Centro',
    owner: 'USER',
    ownerId: 'user-id',
  });
});

it('SHOULD answer 404 for an unreachable owner AND 422 for an archived family', async () => {
  await expect(setup.execute({ ...base, ownerId: 'stranger' })).rejects.toThrow(NotFoundException);
  await expect(
    setup.execute({
      ...base,
      accessibleOwners: mocks.archivedOwners,
      owner: 'FAMILY' as never,
      ownerId: 'family-id',
    }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse an empty name', async () => {
  await expect(setup.execute({ ...base, name: '  ' })).rejects.toBeDefined();
});

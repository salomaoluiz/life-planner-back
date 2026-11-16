import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

describe('GetConversionByIdUseCase', () => {
  it('SHOULD return the stored snapshot of both sides', async () => {
    const { conversion, destination, origin } = mocks.scenario();

    spies.findConversionById.mockResolvedValue(conversion);
    spies.findAssetById.mockImplementation(async (id: string) =>
      id === origin.id ? origin : destination,
    );

    const result = await setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1' });

    expect(result.from).toMatchObject({ cost: 808550, operationId: 'out-1', ticker: 'BCFF11' });
    expect(result.from.quantity.toString()).toBe('103');
    expect(result.to).toMatchObject({ cost: 808550, fractionCost: 212, operationId: 'in-1' });
    expect(result.to.quantity.toString()).toBe('762');
    expect(result.to.fractionQuantity.toString()).toBe('0.2');
    expect(result.locked).toBe(false);
  });

  it('SHOULD answer 404 WHEN the caller reads neither asset', async () => {
    const { conversion, destination, origin } = mocks.scenario();

    spies.findConversionById.mockResolvedValue(conversion);
    spies.findAssetById.mockImplementation(async (id: string) =>
      id === origin.id ? origin : destination,
    );

    await expect(
      setup.execute({ accessibleOwners: [{ owner: 'USER' as never, ownerId: 'other' }], id: 'c' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD answer 404 WHEN the conversion does not exist', async () => {
    spies.findConversionById.mockResolvedValue(undefined);

    await expect(setup.execute({ accessibleOwners: mocks.owners, id: 'c' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

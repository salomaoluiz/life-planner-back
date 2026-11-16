import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { NegativePositionError } from '@investment/domain/error/NegativePositionError';

import { mocks, setup, spies } from './index.mocks';

function load(overrides: { locked?: boolean } = {}) {
  const { conversion, destination, origin } = mocks.scenario();

  spies.findConversionById.mockResolvedValue({ ...conversion, ...overrides });
  spies.findAssetById.mockImplementation(async (id: string) =>
    id === origin.id ? origin : destination,
  );

  return { destination, origin };
}

describe('DeleteConversionUseCase', () => {
  it('SHOULD delete the conversion through the repository', async () => {
    load();

    await setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1' });

    expect(spies.deleteConversion).toHaveBeenCalledWith('conv-1');
  });

  it('SHOULD answer 404 WHEN the origin is not readable', async () => {
    load();

    await expect(
      setup.execute({ accessibleOwners: [{ owner: 'USER' as never, ownerId: 'x' }], id: 'conv-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD refuse 422 CONVERSION_CHAIN_LOCKED WHEN the destination was converted again', async () => {
    load({ locked: true });

    await expect(
      setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1' }),
    ).rejects.toMatchObject({
      response: {
        code: 'CONVERSION_CHAIN_LOCKED',
        message: 'Delete the conversion from BTHF11 on 2026-10-15 first.',
      },
    });
    expect(spies.deleteConversion).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 with the date WHEN the destination sold the converted quotas', async () => {
    load();
    spies.deleteConversion.mockRejectedValue(new NegativePositionError('2026-11-01', 'op-9'));

    await expect(
      setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SHOULD refuse WHEN the cash row uses an account the caller cannot change', async () => {
    const { origin } = load();

    origin.operations[0].accountId = 'acc-1';
    spies.findAccountForOperation.mockResolvedValue({
      archived: false,
      currency: 'BRL',
      id: 'acc-1',
      owner: 'USER',
      ownerId: 'user-1',
    });

    await setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1' });
    expect(spies.findAccountForOperation).toHaveBeenCalledWith('acc-1');
  });
});

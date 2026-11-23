import { ConflictException } from '@nestjs/common';

import { Prisma } from '@db/client';

import { raw, setup, spies, toMarket } from './index.mocks';

function duplicate() {
  return new Prisma.PrismaClientKnownRequestError('dup', { clientVersion: 'x', code: 'P2002' });
}

describe('toMarket', () => {
  it('SHOULD map the columns AND turn a null neighborhood into undefined', () => {
    expect(toMarket(raw)).toMatchObject({
      id: 'm1',
      name: 'Bom Preço',
      neighborhood: 'Centro',
      owner: 'USER',
      status: 'ACTIVE',
    });
    expect(toMarket({ ...raw, neighborhood: null }).neighborhood).toBeUndefined();
  });
});

describe('create / update', () => {
  it('SHOULD create AND update the market', async () => {
    spies.create.mockResolvedValue(raw);
    spies.update.mockResolvedValue({ ...raw, status: 'ARCHIVED' });

    expect(
      (await setup.create({ name: 'Bom Preço', owner: 'USER' as never, ownerId: 'user-id' })).id,
    ).toBe('m1');
    expect(spies.create.mock.calls[0][0].data).toMatchObject({
      name: 'Bom Preço',
      owner_id: 'user-id',
    });
    expect((await setup.update({ id: 'm1', status: 'ARCHIVED' as never })).status).toBe('ARCHIVED');
  });

  it('SHOULD answer 409 on a duplicate name AND rethrow anything else', async () => {
    spies.create.mockRejectedValue(duplicate());
    spies.update.mockRejectedValue(duplicate());
    await expect(setup.create({ name: 'x', owner: 'USER' as never, ownerId: 'u' })).rejects.toThrow(
      ConflictException,
    );
    await expect(setup.update({ id: 'm1', name: 'x' })).rejects.toThrow(ConflictException);

    spies.create.mockRejectedValue(new Error('boom'));
    await expect(setup.create({ name: 'x', owner: 'USER' as never, ownerId: 'u' })).rejects.toThrow(
      'boom',
    );
  });
});

describe('reads', () => {
  it('SHOULD find by id AND by owners (active unless asked)', async () => {
    spies.findUnique.mockResolvedValueOnce(raw).mockResolvedValueOnce(null);
    spies.findMany.mockResolvedValue([raw]);

    expect((await setup.findById('m1'))?.id).toBe('m1');
    expect(await setup.findById('x')).toBeUndefined();
    expect(
      await setup.findByOwners([{ owner: 'USER' as never, ownerId: 'user-id' }], false),
    ).toHaveLength(1);
    expect(spies.findMany.mock.calls[0][0].where.status).toBe('ACTIVE');

    await setup.findByOwners([{ owner: 'USER' as never, ownerId: 'user-id' }], true);
    expect(spies.findMany.mock.calls[1][0].where.status).toBeUndefined();
  });

  it('SHOULD delete the markets of an owner', async () => {
    await setup.deleteByOwner({ owner: 'FAMILY' as never, ownerId: 'f' });

    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { owner: 'FAMILY', owner_id: 'f' } });
  });
});

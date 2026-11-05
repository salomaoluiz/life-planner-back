import { setup, spies } from './index.mocks';

describe('Method findByUser', () => {
  it('SHOULD return the account id WHEN the user has a favorite', async () => {
    spies.findUnique.mockResolvedValue({ account_id: 'a1' });

    expect(await setup.findByUser('u1')).toBe('a1');
    expect(spies.findUnique).toHaveBeenCalledWith({
      select: { account_id: true },
      where: { user_id: 'u1' },
    });
  });

  it('SHOULD return undefined WHEN the user has no row', async () => {
    spies.findUnique.mockResolvedValue(null);

    expect(await setup.findByUser('u1')).toBeUndefined();
  });
});

describe('Method upsert', () => {
  it('SHOULD replace the favorite of the user in one statement', async () => {
    await setup.upsert('u1', 'a2');

    expect(spies.upsert).toHaveBeenCalledWith({
      create: { account_id: 'a2', user_id: 'u1' },
      update: { account_id: 'a2' },
      where: { user_id: 'u1' },
    });
  });
});

describe('Method delete*', () => {
  it('SHOULD delete only the row of that user pointing to that account', async () => {
    await setup.deleteForUser('u1', 'a1');

    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { account_id: 'a1', user_id: 'u1' } });
  });

  it('SHOULD delete every row of an account', async () => {
    await setup.deleteByAccount('a1');

    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { account_id: 'a1' } });
  });

  it('SHOULD filter family accounts AND the given users only WHEN userIds is set', async () => {
    await setup.deleteByFamily({ family_id: 'f1', user_ids: ['u1'] });
    await setup.deleteByFamily({ family_id: 'f1' });

    expect(spies.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { account: { owner: 'FAMILY', owner_id: 'f1' }, user_id: { in: ['u1'] } },
    });
    expect(spies.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { account: { owner: 'FAMILY', owner_id: 'f1' } },
    });
  });
});

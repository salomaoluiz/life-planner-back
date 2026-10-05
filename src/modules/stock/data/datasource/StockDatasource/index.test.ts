import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD insert the row AND return it', async () => {
    spies.create.mockResolvedValue(mocks.stock);
    const params = {
      description: 'Rice',
      owner: 'USER' as const,
      owner_id: mocks.stock.owner_id,
      quantity: 2,
      unit: 'kilogram' as const,
    };

    expect(await setup.create(params)).toEqual(mocks.stock);
    expect(spies.create).toHaveBeenCalledWith({ data: params });
  });
});

describe('Method delete', () => {
  it('SHOULD deleteMany by id so a row that is already gone does not throw', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.stock.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.stock.id } });
  });
});

describe('Method exists', () => {
  const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

  it('SHOULD select only the id of the first row of the owner', async () => {
    spies.findFirst.mockResolvedValue({ id: 'x' });

    expect(await setup.exists(params)).toBe(true);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });

  it('SHOULD be false WHEN the owner has none', async () => {
    spies.findFirst.mockResolvedValue(null);

    expect(await setup.exists(params)).toBe(false);
  });
});

describe('Method findById', () => {
  it('SHOULD return the row or null', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.stock).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.stock.id)).toEqual(mocks.stock);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.stock.id } });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every (owner, owner_id) pair in ONE findMany', async () => {
    spies.findMany.mockResolvedValue([mocks.stock]);

    expect(await setup.findByOwners(mocks.owners)).toEqual([mocks.stock]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { owner: 'USER', owner_id: mocks.owners[0].ownerId },
          { owner: 'FAMILY', owner_id: mocks.owners[1].ownerId },
        ],
      },
    });
  });
});

describe('Method update', () => {
  it('SHOULD forward only the given columns (null clears, undefined is a no-op)', async () => {
    spies.update.mockResolvedValue(mocks.stock);

    await setup.update({ id: mocks.stock.id, notes: null, quantity: 3 });

    expect(spies.update).toHaveBeenCalledWith({
      data: {
        barcode: undefined,
        brand: undefined,
        description: undefined,
        expiration_date: undefined,
        notes: null,
        opening_date: undefined,
        owner: undefined,
        owner_id: undefined,
        purchase_date: undefined,
        quantity: 3,
        unit: undefined,
      },
      where: { id: mocks.stock.id },
    });
  });
});

import { key, setup, spies } from './index.mocks';

describe('addRow', () => {
  it('SHOULD create an item row as MANUAL and store the typed price on the item', async () => {
    spies.itemFindUniqueOrThrow.mockResolvedValue({ id: 'i' });
    spies.rowFindFirst.mockResolvedValue(null);

    const result = await setup.addRow({
      estimated_unit_price_cents: 489,
      item_id: 'i',
      list_id: 'l',
      quantity: 2,
      user_id: 'u',
    });

    expect(spies.itemUpdate).toHaveBeenCalledWith({
      data: { estimated_unit_price_cents: 489 },
      where: { id: 'i' },
    });
    expect(spies.rowCreate).toHaveBeenCalledWith({
      data: { created_by: 'u', item_id: 'i', list_id: 'l', origin: 'MANUAL', quantity: 2 },
    });
    expect(result).toEqual({ merged: false, row: { id: 'row' } });
  });

  it('SHOULD sum the quantity (thousandths) WHEN the item is already there, AUTO becoming AUTO_EDITED', async () => {
    spies.itemFindUniqueOrThrow.mockResolvedValue({ id: 'i' });
    spies.rowFindFirst.mockResolvedValue({ id: 'r', origin: 'AUTO', quantity: 0.1 });

    const result = await setup.addRow({ item_id: 'i', list_id: 'l', quantity: 0.2, user_id: 'u' });

    expect(spies.rowUpdate).toHaveBeenCalledWith({
      data: { origin: 'AUTO_EDITED', quantity: 0.3 },
      where: { id: 'r' },
    });
    expect(result.merged).toBe(true);
    expect(spies.rowCreate).not.toHaveBeenCalled();
  });

  it('SHOULD keep MANUAL when merging into a manual row', async () => {
    spies.itemFindUniqueOrThrow.mockResolvedValue({ id: 'i' });
    spies.rowFindFirst.mockResolvedValue({ id: 'r', origin: 'MANUAL', quantity: 1 });

    await setup.addRow({ item_id: 'i', list_id: 'l', quantity: 1, user_id: 'u' });

    expect(spies.rowUpdate).toHaveBeenCalledWith({
      data: { origin: 'MANUAL', quantity: 2 },
      where: { id: 'r' },
    });
  });

  it('SHOULD restore with the given origin AND clear the dismissal (creating or overwriting the row)', async () => {
    spies.itemFindUniqueOrThrow.mockResolvedValue({ id: 'i' });
    spies.rowFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'r' });

    await setup.addRow({
      item_id: 'i',
      list_id: 'l',
      origin: 'AUTO',
      quantity: 6,
      restore: true,
      user_id: 'u',
    });
    expect(spies.dismissalDeleteMany).toHaveBeenCalledWith({ where: { item_id: 'i' } });
    expect(spies.rowCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ origin: 'AUTO', quantity: 6 }),
    });

    const second = await setup.addRow({
      item_id: 'i',
      list_id: 'l',
      quantity: 4,
      restore: true,
      user_id: 'u',
    });
    expect(spies.rowUpdate).toHaveBeenCalledWith({
      data: { origin: 'MANUAL', quantity: 4 },
      where: { id: 'r' },
    });
    expect(second.merged).toBe(false);
  });

  it('SHOULD create a text row with its own price', async () => {
    await setup.addRow({
      description: 'Candle',
      estimated_unit_price_cents: 1800,
      list_id: 'l',
      quantity: 1,
      unit: 'unit',
      user_id: 'u',
    });

    expect(spies.rowCreate).toHaveBeenCalledWith({
      data: {
        created_by: 'u',
        description: 'Candle',
        estimated_unit_price_cents: 1800,
        list_id: 'l',
        origin: 'MANUAL',
        quantity: 1,
        unit: 'unit',
      },
    });
    expect(spies.itemFindUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('create', () => {
  it('SHOULD clear the previous default and re-home the AUTO rows WHEN the new list is the default', async () => {
    spies.rowFindMany.mockResolvedValue([{ item_id: 'i' }]);

    await setup.create({ currency: 'BRL', is_default: true, name: 'A', ...key });

    expect(spies.listUpdateMany).toHaveBeenCalledWith({
      data: { is_default: false },
      where: { ...key, is_default: true },
    });
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['i']);
  });

  it('SHOULD only insert WHEN it is not the default', async () => {
    await setup.create({ currency: 'BRL', is_default: false, name: 'A', ...key });

    expect(spies.listUpdateMany).not.toHaveBeenCalled();
    expect(spies.sync).not.toHaveBeenCalled();
  });
});

describe('deleteRow', () => {
  it('SHOULD delete the row and dismiss the item WHEN it is an item row', async () => {
    spies.rowFindUnique.mockResolvedValue({ id: 'r', item_id: 'i' });

    await setup.deleteRow('r', 'u');

    expect(spies.rowDelete).toHaveBeenCalledWith({ where: { id: 'r' } });
    expect(spies.dismiss).toHaveBeenCalledWith(expect.anything(), 'i', 'u');
  });

  it('SHOULD not dismiss for a text row AND do nothing for a missing one', async () => {
    spies.rowFindUnique.mockResolvedValueOnce({ id: 'r', item_id: null });
    await setup.deleteRow('r', 'u');
    expect(spies.dismiss).not.toHaveBeenCalled();

    spies.rowFindUnique.mockResolvedValueOnce(null);
    await setup.deleteRow('x', 'u');
    expect(spies.rowDelete).toHaveBeenCalledTimes(1);
  });
});

describe('ensureDefault', () => {
  it('SHOULD return the existing default without writing', async () => {
    spies.listFindFirst.mockResolvedValue({ id: 'd' });

    expect(await setup.ensureDefault(key, 'Mercado')).toEqual({ id: 'd' });
    expect(spies.listCreateMany).not.toHaveBeenCalled();
  });

  it('SHOULD create it skipping duplicates AND sync the owner items WHEN this call created it', async () => {
    spies.listFindFirst.mockResolvedValue(null);
    spies.listCreateMany.mockResolvedValue({ count: 1 });
    spies.listFindFirstOrThrow.mockResolvedValue({ id: 'd' });

    expect(await setup.ensureDefault(key, 'Mercado')).toEqual({ id: 'd' });
    expect(spies.listCreateMany).toHaveBeenCalledWith({
      data: [{ ...key, is_default: true, name: 'Mercado' }],
      skipDuplicates: true,
    });
    expect(spies.syncOwner).toHaveBeenCalledWith(expect.anything(), [key]);
  });

  it('SHOULD not sync WHEN a concurrent call created it first', async () => {
    spies.listFindFirst.mockResolvedValue(null);
    spies.listCreateMany.mockResolvedValue({ count: 0 });
    spies.listFindFirstOrThrow.mockResolvedValue({ id: 'd' });

    await setup.ensureDefault(key, 'Mercado');

    expect(spies.syncOwner).not.toHaveBeenCalled();
  });
});

describe('reads', () => {
  it('SHOULD find lists by id and by owners (default first, active only unless asked)', async () => {
    await setup.findById('l');
    await setup.findByOwners([key], false);
    await setup.findByOwners([key], true);

    expect(spies.listFindUnique).toHaveBeenCalledWith({ where: { id: 'l' } });
    expect(spies.listFindMany).toHaveBeenNthCalledWith(1, {
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      where: { OR: [key], status: 'ACTIVE' },
    });
    expect(spies.listFindMany).toHaveBeenNthCalledWith(2, {
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      where: { OR: [key] },
    });
  });

  it('SHOULD skip the query WHEN there is nothing to look for', async () => {
    expect(await setup.findByOwners([], false)).toEqual([]);
    expect(await setup.findRestockRows([])).toEqual([]);
    expect(await setup.findRowsByLists([])).toEqual([]);
    expect(spies.listFindMany).not.toHaveBeenCalled();
    expect(spies.rowFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD read rows with their item and list', async () => {
    await setup.findRowById('r');
    await setup.findRowsByLists(['l']);
    await setup.findRestockRows([key]);

    expect(spies.rowFindUnique).toHaveBeenCalledWith({
      include: expect.objectContaining({ list: true }),
      where: { id: 'r' },
    });
    expect(spies.rowFindMany).toHaveBeenNthCalledWith(1, {
      include: expect.any(Object),
      orderBy: { id: 'asc' },
      where: { list_id: { in: ['l'] } },
    });
    expect(spies.rowFindMany).toHaveBeenNthCalledWith(2, {
      include: expect.any(Object),
      orderBy: { id: 'asc' },
      where: {
        list: { OR: [key], status: 'ACTIVE' },
        origin: { in: ['AUTO', 'AUTO_EDITED', 'FORECAST'] },
      },
    });
  });

  it('SHOULD purge the lists of an owner', async () => {
    await setup.deleteByOwner(key);

    expect(spies.listDeleteMany).toHaveBeenCalledWith({ where: key });
  });
});

describe('update', () => {
  it('SHOULD move the AUTO rows to the default WHEN archiving (items read before, synced after)', async () => {
    spies.listFindUniqueOrThrow.mockResolvedValue({
      ...key,
      id: 'l',
      is_default: false,
      status: 'ACTIVE',
    });
    spies.rowFindMany.mockResolvedValue([{ item_id: 'i' }]);

    await setup.update({ id: 'l', status: 'ARCHIVED' });

    expect(spies.listUpdate).toHaveBeenCalledWith({
      data: { status: 'ARCHIVED' },
      where: { id: 'l' },
    });
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['i']);
  });

  it('SHOULD clear the previous default and re-home every AUTO row WHEN promoting a list', async () => {
    spies.listFindUniqueOrThrow.mockResolvedValue({
      ...key,
      id: 'l',
      is_default: false,
      status: 'ACTIVE',
    });
    spies.rowFindMany.mockResolvedValue([{ item_id: 'a' }, { item_id: 'b' }]);

    await setup.update({ id: 'l', is_default: true });

    expect(spies.listUpdateMany).toHaveBeenCalledWith({
      data: { is_default: false },
      where: { ...key, id: { not: 'l' }, is_default: true },
    });
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['a', 'b']);
  });

  it('SHOULD only write WHEN renaming (nothing to re-home)', async () => {
    spies.listFindUniqueOrThrow.mockResolvedValue({
      ...key,
      id: 'l',
      is_default: false,
      status: 'ACTIVE',
    });

    await setup.update({ id: 'l', name: 'New' });

    expect(spies.rowFindMany).not.toHaveBeenCalled();
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), []);
  });
});

describe('updateRow', () => {
  it('SHOULD freeze an AUTO row as AUTO_EDITED WHEN the quantity changes and store the price on the item', async () => {
    spies.rowFindUniqueOrThrow.mockResolvedValueOnce({
      id: 'r',
      item_id: 'i',
      origin: 'AUTO',
      quantity: 6,
    });

    await setup.updateRow({ estimated_unit_price_cents: 489, id: 'r', quantity: 8 });

    expect(spies.itemUpdate).toHaveBeenCalledWith({
      data: { estimated_unit_price_cents: 489 },
      where: { id: 'i' },
    });
    expect(spies.rowUpdate).toHaveBeenCalledWith({
      data: { origin: 'AUTO_EDITED', quantity: 8 },
      where: { id: 'r' },
    });
  });

  it('SHOULD keep AUTO WHEN only the price changes or the quantity is the same', async () => {
    spies.rowFindUniqueOrThrow.mockResolvedValue({
      id: 'r',
      item_id: 'i',
      origin: 'AUTO',
      quantity: 6,
    });

    await setup.updateRow({ estimated_unit_price_cents: 100, id: 'r' });
    await setup.updateRow({ id: 'r', quantity: 6 });

    expect(spies.rowUpdate).toHaveBeenNthCalledWith(1, {
      data: { origin: undefined, quantity: undefined },
      where: { id: 'r' },
    });
    expect(spies.rowUpdate).toHaveBeenNthCalledWith(2, {
      data: { origin: undefined, quantity: 6 },
      where: { id: 'r' },
    });
  });

  it('SHOULD write description, unit and price on a text row', async () => {
    spies.rowFindUniqueOrThrow.mockResolvedValue({
      id: 'r',
      item_id: null,
      origin: 'MANUAL',
      quantity: 1,
    });

    await setup.updateRow({
      description: 'Big',
      estimated_unit_price_cents: null,
      id: 'r',
      unit: 'unit',
    });

    expect(spies.itemUpdate).not.toHaveBeenCalled();
    expect(spies.rowUpdate).toHaveBeenCalledWith({
      data: { description: 'Big', estimated_unit_price_cents: null, unit: 'unit' },
      where: { id: 'r' },
    });
  });
});

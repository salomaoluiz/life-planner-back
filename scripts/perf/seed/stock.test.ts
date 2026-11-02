import { createRng } from './random';
import { buildStockItems, seedStock } from './stock';

const refs = { familyIds: ['f1', 'f2', 'f3'], personal: 'u1' };
const today = '2026-11-02';
const build = (count = 300) => buildStockItems(count, refs, today, createRng(64));

describe('buildStockItems', () => {
  it('is deterministic for the same seed', () => {
    expect(build()).toEqual(build());
  });

  it('builds the requested count with the Perf prefix', () => {
    const items = build(100);

    expect(items).toHaveLength(100);
    expect(items.every((item) => item.description.startsWith('Perf item '))).toBe(true);
    expect(new Set(items.map((item) => item.description)).size).toBe(100);
  });

  it('puts about a third in families and rotates the five units', () => {
    const items = build(300);
    const family = items.filter((item) => item.owner === 'FAMILY');

    expect(family.length).toBe(100);
    expect(family.every((item) => refs.familyIds.includes(item.ownerId))).toBe(true);
    expect(
      items.filter((item) => item.owner === 'USER').every((item) => item.ownerId === 'u1'),
    ).toBe(true);
    expect(new Set(items.map((item) => item.unit)).size).toBe(5);
  });

  it('has expired and soon-to-expire items', () => {
    const items = build(300);
    const days = items
      .filter((item) => item.expirationDate)
      .map(
        (item) =>
          (Date.parse(item.expirationDate as string) - Date.parse(`${today}T00:00:00Z`)) / 86400000,
      );

    expect(days.some((d) => d < 0)).toBe(true);
    expect(days.some((d) => d >= 0 && d <= 7)).toBe(true);
    expect(days.some((d) => d > 7)).toBe(true);
  });
});

describe('seedStock', () => {
  function clientWith(existing: number) {
    return {
      get: jest
        .fn()
        .mockResolvedValue(
          Array.from({ length: existing }, (_, i) => ({ description: `Perf item ${i}` })),
        ),
      post: jest.fn().mockResolvedValue({}),
    };
  }

  it('creates only the missing part', async () => {
    const client = clientWith(400);

    const created = await seedStock(client as never, { items: 1000 }, refs, today, createRng(64));

    expect(created).toBe(600);
    expect(client.post).toHaveBeenCalledTimes(600);
    expect(client.post.mock.calls[0][0]).toBe('/api/v1/stock/items');
  });

  it('ignores items that are not Perf ones and creates nothing when complete', async () => {
    const client = clientWith(1000);
    client.get.mockResolvedValue([
      ...Array.from({ length: 1000 }, (_, i) => ({ description: `Perf item ${i}` })),
      { description: 'Milk' },
    ]);

    expect(await seedStock(client as never, { items: 1000 }, refs, today, createRng(64))).toBe(0);
    expect(client.post).not.toHaveBeenCalled();
  });
});

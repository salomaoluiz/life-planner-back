import { groupRows } from './index';

const names: Record<string, string> = { bakery: 'Bakery', dairy: 'Dairy' };
function nameOf(id: string) {
  return names[id];
}

it('SHOULD group by category name, rows by description, and leave "Outros" last with subtotals', () => {
  const groups = groupRows(
    [
      { categoryId: 'dairy', description: 'Milk', estimateCents: 100 },
      { description: 'Candle', estimateCents: 50 },
      { categoryId: 'bakery', description: 'Bread' },
      { categoryId: 'dairy', description: 'Butter', estimateCents: 20 },
      { categoryId: 'gone', description: 'Orphan' },
    ],
    nameOf,
  );

  expect(groups.map((group) => group.categoryId)).toEqual(['bakery', 'dairy', undefined]);
  expect(groups[1].rows.map((row) => row.description)).toEqual(['Butter', 'Milk']);
  expect(groups[1].subtotalCents).toBe(120);
  expect(groups[0].unpricedCount).toBe(1);
  expect(groups[2].rows.map((row) => row.description)).toEqual(['Candle', 'Orphan']);
});

it('SHOULD return no groups WHEN there are no rows', () => {
  expect(groupRows([], nameOf)).toEqual([]);
});

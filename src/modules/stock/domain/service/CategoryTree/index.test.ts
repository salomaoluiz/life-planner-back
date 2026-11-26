import {
  depthOf,
  descendantIds,
  effectiveFinanceCategoryId,
  MAX_LOCATION_DEPTH,
  pathOf,
  subtreeHeight,
} from './index';

const categories = [
  { financeCategoryId: 'fin-1', id: 'dairy', name: 'Dairy' },
  { id: 'cheese', name: 'Cheese', parentId: 'dairy' },
  { id: 'mozzarella', name: 'Mozzarella', parentId: 'cheese' },
  { id: 'meat', name: 'Meat' },
];

it('SHOULD compute depth and path', () => {
  expect(depthOf(categories, 'dairy')).toBe(0);
  expect(depthOf(categories, 'mozzarella')).toBe(2);
  expect(pathOf(categories, 'mozzarella')).toBe('Dairy / Cheese / Mozzarella');
  expect(pathOf(categories, 'missing')).toBe('');
});

it('SHOULD list a category and every descendant', () => {
  expect(descendantIds(categories, 'dairy').sort()).toEqual(['cheese', 'dairy', 'mozzarella']);
  expect(descendantIds(categories, 'meat')).toEqual(['meat']);
});

it('SHOULD inherit the finance mapping from the closest mapped ancestor', () => {
  expect(effectiveFinanceCategoryId(categories, 'mozzarella')).toBe('fin-1');
  expect(effectiveFinanceCategoryId(categories, 'meat')).toBeUndefined();
});

it('SHOULD measure the subtree height', () => {
  expect(subtreeHeight(categories, 'dairy')).toBe(2);
  expect(subtreeHeight(categories, 'meat')).toBe(0);
});

it('SHOULD limit locations to two levels', () => {
  expect(MAX_LOCATION_DEPTH).toBe(2);
});

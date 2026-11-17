export const MAX_CATEGORY_DEPTH = 3;

export interface TreeCategory {
  financeCategoryId?: string;
  id: string;
  name: string;
  parentId?: string;
}

export function depthOf(categories: TreeCategory[], id: string): number {
  const byId = new Map(categories.map((category) => [category.id, category]));
  let depth = 0;
  let current = byId.get(id);

  while (current?.parentId) {
    depth += 1;
    current = byId.get(current.parentId);
  }

  return depth;
}

// "Dairy / Cheese" (FR 34).
export function pathOf(categories: TreeCategory[], id: string): string {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const names: string[] = [];
  let current = byId.get(id);

  while (current) {
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return names.join(' / ');
}

// FR 25: the id itself and every descendant.
export function descendantIds(categories: TreeCategory[], id: string): string[] {
  const ids = [id];

  for (let index = 0; index < ids.length; index += 1) {
    ids.push(
      ...categories
        .filter((category) => category.parentId === ids[index])
        .map((category) => category.id),
    );
  }

  return ids;
}

// FR 22: a subcategory without its own mapping inherits its parent's.
export function effectiveFinanceCategoryId(
  categories: TreeCategory[],
  id: string,
): string | undefined {
  const byId = new Map(categories.map((category) => [category.id, category]));
  let current = byId.get(id);

  while (current) {
    if (current.financeCategoryId) {
      return current.financeCategoryId;
    }

    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return undefined;
}

// Height of the subtree under `id` (a leaf is 0), to check a re-parenting against MAX_CATEGORY_DEPTH.
export function subtreeHeight(categories: TreeCategory[], id: string): number {
  const children = categories.filter((category) => category.parentId === id);

  return children.length === 0
    ? 0
    : 1 + Math.max(...children.map((child) => subtreeHeight(categories, child.id)));
}

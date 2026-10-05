import CategoryEntity from '@finance/domain/entity/CategoryEntity';

// Breadth-first walk over `parentId`; the `seen` set keeps it finite even on corrupted data.
export function collectDescendants(categories: CategoryEntity[], rootId: string): CategoryEntity[] {
  const childrenByParent = new Map<string, CategoryEntity[]>();

  for (const category of categories) {
    if (category.parentId !== undefined) {
      childrenByParent.set(category.parentId, [
        ...(childrenByParent.get(category.parentId) ?? []),
        category,
      ]);
    }
  }

  const descendants: CategoryEntity[] = [];
  const seen = new Set<string>([rootId]);
  const queue: string[] = [rootId];

  for (let index = 0; index < queue.length; index += 1) {
    for (const child of childrenByParent.get(queue[index]) ?? []) {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        descendants.push(child);
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

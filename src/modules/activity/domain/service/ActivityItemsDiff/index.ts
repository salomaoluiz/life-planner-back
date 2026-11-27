import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivityAction } from '@activity/domain/enum';

function key(item: ActivityItemInput): string {
  return `${item.entityType}:${item.entityId}`;
}
function same(a: ActivityItemInput, b: ActivityItemInput): boolean {
  return (
    a.label === b.label &&
    (a.amountCents ?? null) === (b.amountCents ?? null) &&
    (a.bookingDate ?? null) === (b.bookingDate ?? null) &&
    (a.sourceName ?? null) === (b.sourceName ?? null)
  );
}

// Spec 127 FR 8: the rows a batch request created, changed or removed. Unchanged rows are not listed. An item shows
// as it was right after the action (deleted ones as they were before).
export function diffItems(
  before: readonly ActivityItemInput[],
  after: readonly ActivityItemInput[],
): ActivityItemInput[] {
  const previous = new Map(before.map((item) => [key(item), item]));
  const current = new Set(after.map(key));
  const items: ActivityItemInput[] = [];

  after.forEach((item) => {
    const old = previous.get(key(item));

    if (!old) {
      items.push({ ...item, action: ActivityAction.CREATE });
    } else if (!same(old, item)) {
      items.push({ ...item, action: ActivityAction.UPDATE });
    }
  });
  before
    .filter((item) => !current.has(key(item)))
    .forEach((item) => items.push({ ...item, action: ActivityAction.DELETE }));

  return items;
}

import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivityAction, ActivityEntityType } from '@activity/domain/enum';

import { diffItems } from './index';

function item(id: string, amountCents = -100, label = 'x'): ActivityItemInput {
  return {
    action: ActivityAction.CREATE,
    amountCents,
    bookingDate: '2026-10-01',
    entityId: id,
    entityType: ActivityEntityType.TRANSACTION,
    label,
  };
}

describe('diffItems', () => {
  it('SHOULD list created, changed AND deleted rows with their action, and skip the unchanged', () => {
    const result = diffItems(
      [item('same'), item('edit', -100), item('gone')],
      [item('same'), item('edit', -200), item('new')],
    );

    expect(result.map((row) => [row.entityId, row.action])).toEqual([
      ['edit', 'UPDATE'],
      ['new', 'CREATE'],
      ['gone', 'DELETE'],
    ]);
    expect(result[0].amountCents).toBe(-200);
  });

  it('SHOULD return nothing WHEN the group did not change', () => {
    expect(diffItems([item('a')], [item('a')])).toEqual([]);
  });

  it('SHOULD list every row as created WHEN there was nothing before', () => {
    expect(diffItems([], [item('a'), item('b')]).map((row) => row.action)).toEqual([
      'CREATE',
      'CREATE',
    ]);
  });
});

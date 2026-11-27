import { ActivityEntityType } from '@activity/domain/enum';

import { ActivityReaderRegistry } from './index';

describe('ActivityReaderRegistry', () => {
  it('SHOULD return the reader registered for an entity type', () => {
    const registry = new ActivityReaderRegistry();
    const reader = { entityType: ActivityEntityType.TAG, read: jest.fn() };

    registry.register(reader);

    expect(registry.get(ActivityEntityType.TAG)).toBe(reader);
    expect(registry.get(ActivityEntityType.ACCOUNT)).toBeUndefined();
  });
});

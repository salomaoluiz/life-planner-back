import { decodeNoticeCursor } from '@notification/domain/service/NoticeCursor';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

function notice(id: string, minute: number) {
  return {
    createdAt: new Date(Date.UTC(2026, 10, 23, 11, minute)),
    id,
  };
}

it('SHOULD ask for one row more than a page AND return no cursor WHEN the page is the last', async () => {
  mocks.notificationRepository.findPage.mockResolvedValue([notice('a', 2), notice('b', 1)]);

  const result = await setup.execute({ module: 'STOCK', unread: true, userId: 'user-1' });

  expect(mocks.notificationRepository.findPage).toHaveBeenCalledWith({
    cursor: undefined,
    limit: 21,
    module: 'STOCK',
    unread: true,
    userId: 'user-1',
  });
  expect(result).toEqual({ items: [notice('a', 2), notice('b', 1)], nextCursor: undefined });
});

it('SHOULD cut the page at 20 AND point the cursor at its last row WHEN there is more', async () => {
  const rows = Array.from({ length: 21 }, (_, index) => notice(`n-${index}`, 59 - index));
  mocks.notificationRepository.findPage.mockResolvedValue(rows);

  const result = await setup.execute({ userId: 'user-1' });

  expect(result.items).toHaveLength(20);
  expect(decodeNoticeCursor(result.nextCursor as string)).toEqual(rows[19]);
});

it('SHOULD pass a decoded cursor to the repository', async () => {
  const cursor = Buffer.from('2026-11-23T11:00:00.000Z|abc').toString('base64');

  await setup.execute({ cursor, userId: 'user-1' });

  expect(mocks.notificationRepository.findPage).toHaveBeenCalledWith(
    expect.objectContaining({
      cursor: { createdAt: new Date('2026-11-23T11:00:00.000Z'), id: 'abc' },
    }),
  );
});

it('SHOULD answer 400 (ValidationError) WHEN the cursor is not one of ours', async () => {
  await expect(setup.execute({ cursor: 'garbage', userId: 'user-1' })).rejects.toBeInstanceOf(
    ValidationError,
  );
  expect(mocks.notificationRepository.findPage).not.toHaveBeenCalled();
});

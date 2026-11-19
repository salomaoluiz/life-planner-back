import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { SplitController } from './split.controller';
import { mocks, setup } from './split.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';

it('SHOULD be served at /finance/splits under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, SplitController)).toBe('finance/splits');
  expect(Reflect.getMetadata(VERSION_METADATA, SplitController)).toBe('1');
});

it('SHOULD validate the body AND create with the JWT user', async () => {
  expect(await setup.create(mocks.request, mocks.body as never, { today: '2026-11-18' })).toBe(
    mocks.response,
  );
  expect(mocks.splitService.create).toHaveBeenCalledWith(
    mocks.request.user.id,
    mocks.body,
    '2026-11-18',
  );
});

it.each([
  ['an unknown key', { ...mocks.body, owner: 'USER' }],
  [
    'a part with both categoryId and systemKey',
    {
      ...mocks.body,
      parts: [{ categoryId: 'x', systemKey: 'SPLIT_ADJUSTMENT', type: 'EXPENSE', value: 1 }],
    },
  ],
  [
    'a part with a fractional value',
    {
      ...mocks.body,
      parts: [{ categoryId: '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d', type: 'EXPENSE', value: 1.5 }],
    },
  ],
])('SHOULD throw ValidationError WHEN the body has %s', async (_label, bad) => {
  await expect(setup.create(mocks.request, bad as never, {})).rejects.toThrow(ValidationError);
  expect(mocks.splitService.create).not.toHaveBeenCalled();
});

it('SHOULD read AND delete by id with the JWT user', async () => {
  await setup.findById(mocks.request, id);
  await setup.delete(mocks.request, id);

  expect(mocks.splitService.findById).toHaveBeenCalledWith(mocks.request.user.id, id);
  expect(mocks.splitService.delete).toHaveBeenCalledWith(mocks.request.user.id, id);
});

it('SHOULD update with the full body OR only paid, AND reject an empty patch', async () => {
  await setup.update(mocks.request, id, mocks.body as never, { today: '2026-11-18' });
  await setup.update(mocks.request, id, { paid: true } as never, {});

  expect(mocks.splitService.update).toHaveBeenNthCalledWith(
    1,
    mocks.request.user.id,
    id,
    mocks.body,
    '2026-11-18',
  );
  expect(mocks.splitService.update).toHaveBeenNthCalledWith(
    2,
    mocks.request.user.id,
    id,
    { paid: true },
    undefined,
  );
  await expect(setup.update(mocks.request, id, {} as never, {})).rejects.toThrow(ValidationError);
});

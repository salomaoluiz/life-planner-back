import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { ActivityController } from '@api/activity/v1/activity.controller';
import { ActivityService } from '@api/activity/v1/activity.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = { list: jest.fn(), listItems: jest.fn() };
const request = { user: { id: 'user-1' } } as never;
const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

async function build() {
  const module = await Test.createTestingModule({
    controllers: [ActivityController],
    providers: [{ provide: ActivityService, useValue: serviceMock }],
  }).compile();

  return module.get(ActivityController);
}

beforeEach(() => jest.resetAllMocks());

it('SHOULD be served at /activity under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, ActivityController)).toBe('activity');
  expect(Reflect.getMetadata(VERSION_METADATA, ActivityController)).toBe('1');
});

it('SHOULD list with the validated filters', async () => {
  serviceMock.list.mockResolvedValue({ items: [], nextCursor: null });

  await (await build()).list(request, { action: 'BATCH', module: 'FINANCE', q: ' 1.200,00 ' });

  expect(serviceMock.list).toHaveBeenCalledWith('user-1', {
    action: 'BATCH',
    module: 'FINANCE',
    q: '1.200,00',
  });
});

it('SHOULD answer 400 WHEN the module is missing or unknown', async () => {
  const controller = await build();

  await expect(controller.list(request, {})).rejects.toBeInstanceOf(ValidationError);
  await expect(controller.list(request, { module: 'STOCK' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD answer 400 WHEN from is not an ISO instant', async () => {
  await expect(
    (await build()).list(request, { from: 'yesterday', module: 'FINANCE' }),
  ).rejects.toBeInstanceOf(ValidationError);
});

it('SHOULD list the items of a batch WHEN the id is a uuid', async () => {
  serviceMock.listItems.mockResolvedValue({ header: null, items: [], nextCursor: null });

  await (await build()).listItems(request, { id }, { q: 'padaria' });

  expect(serviceMock.listItems).toHaveBeenCalledWith('user-1', id, { q: 'padaria' });
  await expect((await build()).listItems(request, { id: 'x' }, {})).rejects.toBeInstanceOf(
    ValidationError,
  );
});

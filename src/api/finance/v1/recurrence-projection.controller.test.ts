import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { RecurrenceProjectionController } from '@api/finance/v1/recurrence-projection.controller';
import { RecurrenceService } from '@api/finance/v1/recurrence.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = { findProjections: jest.fn().mockResolvedValue([{ recurrenceId: 'r-1' }]) };
const request = { user: { id: 'user-1' } } as never;

async function build() {
  const module = await Test.createTestingModule({
    controllers: [RecurrenceProjectionController],
    providers: [{ provide: RecurrenceService, useValue: serviceMock }],
  }).compile();

  return module.get(RecurrenceProjectionController);
}

it('SHOULD be served at /finance/recurrences/projections under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, RecurrenceProjectionController)).toBe(
    'finance/recurrences/projections',
  );
  expect(Reflect.getMetadata(VERSION_METADATA, RecurrenceProjectionController)).toBe('1');
});

it('SHOULD validate the range AND return the projections of the owners', async () => {
  const setup = await build();
  const owner = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

  const result = await setup.findAll(request, {
    from: '2026-11',
    ownerId: owner,
    to: '2027-03',
    today: '2026-10-17',
  });

  expect(serviceMock.findProjections).toHaveBeenCalledWith(
    'user-1',
    { from: '2026-11', to: '2027-03' },
    [owner],
    '2026-10-17',
    undefined,
  );
  expect(result).toEqual([{ recurrenceId: 'r-1' }]);
});

it('SHOULD reject a missing range', async () => {
  const setup = await build();

  await expect(setup.findAll(request, { from: '2026-11' })).rejects.toThrow(ValidationError);
});

it('SHOULD forward the category, tag, account, card and text filters (spec 045)', async () => {
  const setup = await build();
  const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

  await setup.findAll(request, {
    categoryId: [id],
    from: '2026-11',
    q: 'gym',
    tagId: id,
    to: '2026-12',
  });

  expect(serviceMock.findProjections).toHaveBeenLastCalledWith(
    'user-1',
    { from: '2026-11', to: '2026-12' },
    undefined,
    undefined,
    { categoryIds: [id], q: 'gym', tagIds: [id] },
  );
});

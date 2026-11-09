import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { TransferController } from './transfer.controller';
import { mocks, setup } from './transfer.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';

it('SHOULD be served at /finance/transfers under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, TransferController)).toBe('finance/transfers');
  expect(Reflect.getMetadata(VERSION_METADATA, TransferController)).toBe('1');
});

it('SHOULD validate the body AND create with the JWT user', async () => {
  expect(await setup.create(mocks.request, mocks.body as never, { today: '2026-11-09' })).toBe(
    mocks.response,
  );
  expect(mocks.transferService.create).toHaveBeenCalledWith(
    mocks.request.user.id,
    mocks.body,
    '2026-11-09',
  );
});

it('SHOULD throw ValidationError WHEN the body has an unknown key or a missing amount', async () => {
  await expect(
    setup.create(mocks.request, { ...mocks.body, owner: 'USER' } as never, {}),
  ).rejects.toThrow(ValidationError);
  await expect(setup.create(mocks.request, { description: 'x' } as never, {})).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.transferService.create).not.toHaveBeenCalled();
});

it('SHOULD read AND delete by id with the JWT user', async () => {
  await setup.findById(mocks.request, id);
  await setup.delete(mocks.request, id, {});

  expect(mocks.transferService.findById).toHaveBeenCalledWith(mocks.request.user.id, id);
  expect(mocks.transferService.delete).toHaveBeenCalledWith(mocks.request.user.id, id, undefined);
});

it('SHOULD update with the validated patch AND reject an empty patch', async () => {
  await setup.update(mocks.request, id, { fee: null, paid: false } as never);

  expect(mocks.transferService.update).toHaveBeenCalledWith(mocks.request.user.id, id, {
    fee: null,
    paid: false,
  });
  await expect(setup.update(mocks.request, id, {} as never)).rejects.toThrow(ValidationError);
});

it('SHOULD accept a recurrence on create AND pass the delete scope', async () => {
  await setup.create(
    mocks.request,
    { ...mocks.body, recurrence: { frequency: 'MONTHLY' } } as never,
    {},
  );
  await setup.delete(mocks.request, id, { scope: 'THIS_AND_NEXT' });

  expect(mocks.transferService.create).toHaveBeenCalledWith(
    mocks.request.user.id,
    { ...mocks.body, recurrence: { frequency: 'MONTHLY' } },
    undefined,
  );
  expect(mocks.transferService.delete).toHaveBeenCalledWith(
    mocks.request.user.id,
    id,
    'THIS_AND_NEXT',
  );
  await expect(setup.delete(mocks.request, id, { scope: 'ALL' })).rejects.toThrow(ValidationError);
});

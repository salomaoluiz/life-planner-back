import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { ConversionController } from './conversion.controller';
import { mocks, setup } from './conversion.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const assetId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';
const userId = mocks.request.user.id;
const body = {
  date: '2026-10-15',
  destination: { assetId },
  ratioFrom: '1',
  ratioTo: '7.4',
};

it('SHOULD be served at /investments under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, ConversionController)).toBe('investments');
  expect(Reflect.getMetadata(VERSION_METADATA, ConversionController)).toBe('1');
});

it('SHOULD create a conversion from the origin asset after validating the strict body', async () => {
  expect(await setup.create(mocks.request, id, body as never)).toBe(mocks.result);
  expect(mocks.service.create).toHaveBeenCalledWith(userId, id, body);

  await expect(setup.create(mocks.request, id, { ...body, ratioTo: 7.4 } as never)).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD read, update AND delete a conversion by id', async () => {
  expect(await setup.findById(mocks.request, id)).toBe(mocks.result);
  expect(mocks.service.findById).toHaveBeenCalledWith(userId, id);

  expect(await setup.update(mocks.request, id, { ratioTo: '2' } as never)).toBe(mocks.result);
  expect(mocks.service.update).toHaveBeenCalledWith(userId, id, { ratioTo: '2' });
  await expect(
    setup.update(mocks.request, id, { destination: { assetId } } as never),
  ).rejects.toThrow(ValidationError);

  await setup.delete(mocks.request, id);
  expect(mocks.service.delete).toHaveBeenCalledWith(userId, id);
});

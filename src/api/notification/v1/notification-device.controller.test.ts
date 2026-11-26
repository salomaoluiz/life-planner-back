import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { NotificationDeviceController } from '@api/notification/v1/notification-device.controller';
import { NotificationDeviceService } from '@api/notification/v1/notification-device.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = {
  delete: jest.fn(),
  list: jest.fn(),
  register: jest.fn(),
  seen: jest.fn(),
  sendTest: jest.fn(),
  update: jest.fn(),
  webPushKey: jest.fn(),
};
const request = { user: { id: 'user-1' } } as never;
const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const body = {
  locale: 'pt-BR',
  name: 'iPhone',
  platform: 'IOS',
  provider: 'EXPO',
  timeZone: 'America/Sao_Paulo',
  token: 'ExponentPushToken[x]',
};

async function build() {
  const module = await Test.createTestingModule({
    controllers: [NotificationDeviceController],
    providers: [{ provide: NotificationDeviceService, useValue: serviceMock }],
  }).compile();

  return module.get(NotificationDeviceController);
}

beforeEach(() => jest.resetAllMocks());

it('SHOULD be served at /notifications under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, NotificationDeviceController)).toBe('notifications');
  expect(Reflect.getMetadata(VERSION_METADATA, NotificationDeviceController)).toBe('1');
});

it('SHOULD list devices with the X-Device-Id header', async () => {
  await (await build()).list(request, 'd-1');

  expect(serviceMock.list).toHaveBeenCalledWith('user-1', 'd-1');
});

describe('register', () => {
  it('SHOULD keep 201 for a new device', async () => {
    serviceMock.register.mockResolvedValue({ created: true, id });
    const res = { status: jest.fn() };

    expect(await (await build()).register(request, body, res as never)).toEqual({ id });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('SHOULD answer 200 WHEN the same token was registered before (upsert)', async () => {
    serviceMock.register.mockResolvedValue({ created: false, id });
    const res = { status: jest.fn() };

    await (await build()).register(request, body, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    [{ ...body, platform: 'DESKTOP' }],
    [{ ...body, name: '' }],
    [{ ...body, token: undefined }],
    [{ ...body, locale: 'fr-FR' }],
  ])('SHOULD answer 400 for %j', async (invalid) => {
    await expect(
      (await build()).register(request, invalid, { status: jest.fn() } as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

it('SHOULD update, mark seen AND delete a device by uuid', async () => {
  const setup = await build();

  await setup.update(request, { id }, { enabled: false });
  await setup.seen(request, { id }, { locale: 'pt-BR', timeZone: 'UTC' });
  await setup.remove(request, { id });

  expect(serviceMock.update).toHaveBeenCalledWith('user-1', id, { enabled: false });
  expect(serviceMock.seen).toHaveBeenCalledWith('user-1', id, { locale: 'pt-BR', timeZone: 'UTC' });
  expect(serviceMock.delete).toHaveBeenCalledWith('user-1', id);
});

it('SHOULD answer 400 for a bad id, an unknown field AND a bad seen body', async () => {
  const setup = await build();

  await expect(setup.remove(request, { id: 'x' })).rejects.toBeInstanceOf(ValidationError);
  await expect(setup.update(request, { id }, { token: 'steal' })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(setup.seen(request, { id }, { locale: 'pt-BR' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD send the test push to the given device or the calling one', async () => {
  const setup = await build();

  await setup.test(request, { deviceId: id }, 'd-current');
  await setup.test(request, undefined as never, 'd-current');

  expect(serviceMock.sendTest).toHaveBeenNthCalledWith(1, 'user-1', id, 'd-current');
  expect(serviceMock.sendTest).toHaveBeenNthCalledWith(2, 'user-1', undefined, 'd-current');
});

it('SHOULD answer the VAPID public key', async () => {
  serviceMock.webPushKey.mockReturnValue({ publicKey: 'B' });

  expect((await build()).webPushKey()).toEqual({ publicKey: 'B' });
});

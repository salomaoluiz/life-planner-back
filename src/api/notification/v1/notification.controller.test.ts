import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { NotificationController } from '@api/notification/v1/notification.controller';
import { NotificationService } from '@api/notification/v1/notification.service';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { NotModifiedException } from '@shared/infra/http/not-modified';

const serviceMock = {
  getPreferences: jest.fn(),
  getUnreadStats: jest.fn(),
  list: jest.fn(),
  markAllRead: jest.fn(),
  markRead: jest.fn(),
  summaryPreview: jest.fn(),
  updatePreferences: jest.fn(),
};
const request = { user: { id: 'user-1' } } as never;
const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
async function build() {
  const module = await Test.createTestingModule({
    controllers: [NotificationController],
    providers: [{ provide: NotificationService, useValue: serviceMock }],
  }).compile();

  return module.get(NotificationController);
}
function response() {
  return { setHeader: jest.fn() };
}

beforeEach(() => jest.resetAllMocks());

it('SHOULD be served at /notifications under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, NotificationController)).toBe('notifications');
  expect(Reflect.getMetadata(VERSION_METADATA, NotificationController)).toBe('1');
});

it('SHOULD list with the validated filters (unread arrives as a string)', async () => {
  serviceMock.list.mockResolvedValue({ items: [] });

  await (await build()).list(request, { module: 'STOCK', unread: 'true' });

  expect(serviceMock.list).toHaveBeenCalledWith('user-1', {
    cursor: undefined,
    module: 'STOCK',
    unread: true,
  });
});

it('SHOULD answer 400 for an unknown module filter', async () => {
  await expect((await build()).list(request, { module: 'NOPE' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

describe('unreadCount', () => {
  const stats = { count: 3, lastCreatedAt: new Date(1000), lastReadAt: null };

  it('SHOULD answer the count with an ETag', async () => {
    serviceMock.getUnreadStats.mockResolvedValue(stats);
    const res = response();

    expect(await (await build()).unreadCount(request, undefined, res as never)).toEqual({
      count: 3,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'ETag',
      expect.stringMatching(/^"n-user-1-3-1000-0"$/),
    );
  });

  it('SHOULD answer 304 (private, no-cache) WHEN If-None-Match matches', async () => {
    serviceMock.getUnreadStats.mockResolvedValue(stats);
    const res = response();

    await expect(
      (await build()).unreadCount(request, '"n-user-1-3-1000-0"', res as never),
    ).rejects.toBeInstanceOf(NotModifiedException);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache');
  });
});

it('SHOULD mark one notice read AND all of them (before is optional)', async () => {
  const setup = await build();

  await setup.read(request, { id });
  await setup.readAll(request, { before: '2026-11-20T00:00:00.000Z' });
  await setup.readAll(request, undefined as never);

  expect(serviceMock.markRead).toHaveBeenCalledWith('user-1', id);
  expect(serviceMock.markAllRead).toHaveBeenNthCalledWith(1, 'user-1', '2026-11-20T00:00:00.000Z');
  expect(serviceMock.markAllRead).toHaveBeenNthCalledWith(2, 'user-1', undefined);
});

it('SHOULD answer 400 for an id that is not a uuid AND for a date that is not ISO', async () => {
  const setup = await build();

  await expect(setup.read(request, { id: 'x' })).rejects.toBeInstanceOf(ValidationError);
  await expect(setup.readAll(request, { before: 'yesterday' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD forward the preview and the preferences calls', async () => {
  const setup = await build();
  serviceMock.updatePreferences.mockResolvedValue({ ok: true });

  await setup.summaryPreview(request);
  await setup.getPreferences(request);
  await setup.updatePreferences(request, { summaryTime: '09:00' });

  expect(serviceMock.summaryPreview).toHaveBeenCalledWith('user-1');
  expect(serviceMock.getPreferences).toHaveBeenCalledWith('user-1');
  expect(serviceMock.updatePreferences).toHaveBeenCalledWith('user-1', { summaryTime: '09:00' });
});

it.each([
  [{ summaryTime: '8:00' }],
  [{ billLeadDays: 31 }],
  [{ unknown: true }],
  [{ families: [{ enabled: true, familyId: 'x' }] }],
])('SHOULD answer 400 for the invalid preferences %j', async (body) => {
  await expect((await build()).updatePreferences(request, body)).rejects.toBeInstanceOf(
    ValidationError,
  );
});

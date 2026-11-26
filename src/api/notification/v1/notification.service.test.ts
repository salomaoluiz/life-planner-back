import { NotFoundException } from '@nestjs/common';

import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';

import { NotificationService } from './notification.service';

const mocks = {
  families: { execute: jest.fn() },
  getPreferences: { execute: jest.fn() },
  getUnread: { execute: jest.fn() },
  list: { execute: jest.fn() },
  markAll: { execute: jest.fn() },
  markRead: { execute: jest.fn() },
  tick: { preview: jest.fn() },
  update: { execute: jest.fn() },
};
const service = new NotificationService(
  { notificationTickMinutes: 15 } as never,
  mocks.getPreferences as never,
  mocks.getUnread as never,
  mocks.families as never,
  mocks.list as never,
  mocks.markAll as never,
  mocks.markRead as never,
  mocks.tick as never,
  mocks.update as never,
);
const preferences = {
  ...defaultPreferences('user-1'),
  disabledTypes: ['FINANCE_INVOICE_DUE' as const],
};
const families = [
  { archived: false, familyId: 'family-1', name: 'Casa Exemplo' },
  { archived: true, familyId: 'family-old', name: 'Antiga' },
];

beforeEach(() => {
  jest.resetAllMocks();
  mocks.families.execute.mockResolvedValue(families);
  mocks.getPreferences.execute.mockResolvedValue({ disabledFamilyIds: ['family-1'], preferences });
  mocks.update.execute.mockResolvedValue({ disabledFamilyIds: [], preferences });
});

it('SHOULD render a notice with ISO dates AND no user id', async () => {
  mocks.list.execute.mockResolvedValue({
    items: [
      {
        createdAt: new Date('2026-11-23T11:00:04Z'),
        id: 'n-1',
        items: [
          {
            dedupeKey: 'k',
            dueDate: '2026-11-23',
            owner: 'USER',
            ownerId: 'u',
            position: 0,
            route: '/r',
            snapshot: { description: 'x' },
            sourceId: 's',
            state: 'DUE_TODAY',
            type: 'STOCK_EXPIRING',
          },
        ],
        kind: 'SUMMARY',
        localDate: '2026-11-23',
        readAt: new Date('2026-11-23T12:00:00Z'),
        title: 'Hoje',
        userId: 'user-1',
      },
    ],
    nextCursor: 'c',
  });

  const page = await service.list('user-1', { module: 'STOCK' });

  expect(mocks.list.execute).toHaveBeenCalledWith({ module: 'STOCK', userId: 'user-1' });
  expect(page).toEqual({
    items: [
      {
        createdAt: '2026-11-23T11:00:04.000Z',
        id: 'n-1',
        items: [
          {
            dueDate: '2026-11-23',
            route: '/r',
            snapshot: { description: 'x' },
            state: 'DUE_TODAY',
            type: 'STOCK_EXPIRING',
          },
        ],
        kind: 'SUMMARY',
        localDate: '2026-11-23',
        readAt: '2026-11-23T12:00:00.000Z',
        title: 'Hoje',
      },
    ],
    nextCursor: 'c',
  });
});

it('SHOULD answer readAt null for an unread notice', async () => {
  mocks.list.execute.mockResolvedValue({
    items: [
      {
        createdAt: new Date(),
        id: 'n',
        items: [],
        kind: 'URGENT',
        localDate: '2026-11-23',
        readAt: null,
        title: 't',
      },
    ],
  });

  expect((await service.list('user-1', {})).items[0].readAt).toBeNull();
});

it('SHOULD forward the read calls with the caller as the user', async () => {
  mocks.getUnread.execute.mockResolvedValue({ count: 2 });

  await service.markRead('user-1', 'n-1');
  await service.markAllRead('user-1', '2026-11-20T00:00:00.000Z');
  await service.markAllRead('user-1');

  expect(await service.getUnreadStats('user-1')).toEqual({ count: 2 });
  expect(mocks.markRead.execute).toHaveBeenCalledWith({ id: 'n-1', userId: 'user-1' });
  expect(mocks.markAll.execute).toHaveBeenNthCalledWith(1, {
    before: new Date('2026-11-20T00:00:00.000Z'),
    userId: 'user-1',
  });
  expect(mocks.markAll.execute).toHaveBeenNthCalledWith(2, { before: undefined, userId: 'user-1' });
});

it('SHOULD answer the preferences with times, the type switches AND only ACTIVE families', async () => {
  expect(await service.getPreferences('user-1')).toEqual({
    billLeadDays: 3,
    families: [{ enabled: false, familyId: 'family-1', name: 'Casa Exemplo' }],
    invoiceLeadDays: 3,
    locale: 'pt-BR',
    quietEnd: '07:00',
    quietStart: '22:00',
    summaryTime: '08:00',
    tickMinutes: 15,
    timeZone: 'America/Sao_Paulo',
    types: {
      FINANCE_BILL_DUE: true,
      FINANCE_INVOICE_DUE: false,
      STOCK_EXPIRING: true,
      STOCK_OPENED_EXPIRING: true,
    },
  });
});

it('SHOULD translate a PATCH into minutes, keep the types that were not sent AND pass the member families', async () => {
  await service.updatePreferences('user-1', {
    families: [{ enabled: false, familyId: 'family-1' }],
    quietEnd: '06:30',
    summaryTime: '09:15',
    types: { STOCK_EXPIRING: false },
  });

  expect(mocks.update.execute).toHaveBeenCalledWith({
    families: [{ enabled: false, familyId: 'family-1' }],
    memberFamilyIds: ['family-1'],
    patch: {
      billLeadDays: undefined,
      disabledTypes: ['STOCK_EXPIRING', 'FINANCE_INVOICE_DUE'],
      invoiceLeadDays: undefined,
      locale: undefined,
      quietEndMinute: 390,
      quietStartMinute: undefined,
      summaryMinute: 555,
      timeZone: undefined,
    },
    tickMinutes: 15,
    userId: 'user-1',
  });
});

it('SHOULD turn a type back on AND leave disabledTypes alone WHEN no types are sent', async () => {
  await service.updatePreferences('user-1', {
    quietStart: '23:00',
    types: { FINANCE_INVOICE_DUE: true },
  });
  await service.updatePreferences('user-1', {});

  expect(mocks.update.execute.mock.calls[0][0].patch).toEqual(
    expect.objectContaining({ disabledTypes: [], quietStartMinute: 1380 }),
  );
  expect(mocks.update.execute.mock.calls[1][0].patch.disabledTypes).toBeUndefined();
});

it('SHOULD answer the summary preview with the count AND hasItems', async () => {
  mocks.tick.preview.mockResolvedValueOnce([{}, {}]).mockResolvedValueOnce([]);
  const now = new Date('2026-11-23T11:00:00Z');

  expect(await service.summaryPreview('user-1', now)).toEqual({ count: 2, hasItems: true });
  expect(await service.summaryPreview('user-1', now)).toEqual({ count: 0, hasItems: false });
  expect(mocks.tick.preview).toHaveBeenCalledWith(preferences, new Set(['family-1']), now);
});

it('SHOULD default the preview to the current time', async () => {
  mocks.tick.preview.mockResolvedValue([]);

  await service.summaryPreview('user-1');

  expect(mocks.tick.preview).toHaveBeenCalledWith(preferences, expect.any(Set), expect.any(Date));
  void NotFoundException;
});

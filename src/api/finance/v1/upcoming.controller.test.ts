import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { FinanceEtagGuard } from '@api/finance/v1/finance-etag';
import { UpcomingController } from '@api/finance/v1/upcoming.controller';
import { UpcomingService } from '@api/finance/v1/upcoming.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = { getUpcoming: jest.fn().mockResolvedValue({ next: [] }) };
const request = { user: { id: 'user-1' } } as never;
const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

async function build() {
  const module = await Test.createTestingModule({
    controllers: [UpcomingController],
    providers: [{ provide: UpcomingService, useValue: serviceMock }],
  })
    .overrideGuard(FinanceEtagGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get(UpcomingController);
}

it('SHOULD be served at /finance/upcoming under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, UpcomingController)).toBe('finance/upcoming');
  expect(Reflect.getMetadata(VERSION_METADATA, UpcomingController)).toBe('1');
});

it('SHOULD forward the owners, the window and the client date', async () => {
  const setup = await build();

  const result = await setup.upcoming(request, {
    days: '10',
    limit: '3',
    ownerId: [id],
    today: '2026-11-12',
  });

  expect(serviceMock.getUpcoming).toHaveBeenCalledWith('user-1', {
    days: 10,
    limit: 3,
    ownerIds: [id],
    today: '2026-11-12',
  });
  expect(result).toEqual({ next: [] });
});

it('SHOULD answer 400 (ValidationError) without an owner id', async () => {
  const setup = await build();

  await expect(setup.upcoming(request, {})).rejects.toBeInstanceOf(ValidationError);
});

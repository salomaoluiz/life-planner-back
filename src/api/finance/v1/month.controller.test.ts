import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { FinanceEtagGuard } from '@api/finance/v1/finance-etag';
import { MonthController } from '@api/finance/v1/month.controller';
import { MonthService } from '@api/finance/v1/month.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = { find: jest.fn().mockResolvedValue({ month: '2026-11' }) };
const request = { user: { id: 'user-1' } } as never;
const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

async function build() {
  const module = await Test.createTestingModule({
    controllers: [MonthController],
    providers: [{ provide: MonthService, useValue: serviceMock }],
  })
    .overrideGuard(FinanceEtagGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get(MonthController);
}

it('SHOULD be served at /finance/month under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, MonthController)).toBe('finance/month');
  expect(Reflect.getMetadata(VERSION_METADATA, MonthController)).toBe('1');
});

it('SHOULD forward the month, the owners, the filter AND today', async () => {
  const setup = await build();

  const result = await setup.find(request, {
    month: '2026-11',
    ownerId: id,
    paid: 'false',
    q: 'gym',
    today: '2026-11-02',
  });

  expect(serviceMock.find).toHaveBeenCalledWith(
    'user-1',
    '2026-11',
    [id],
    { paid: false, q: 'gym' },
    '2026-11-02',
  );
  expect(result).toEqual({ month: '2026-11' });
});

it('SHOULD reject a missing or invalid month AND a period (from/to)', async () => {
  const setup = await build();

  await expect(setup.find(request, {})).rejects.toThrow(ValidationError);
  await expect(setup.find(request, { month: '2026-13' })).rejects.toThrow(ValidationError);
  await expect(setup.find(request, { from: '2026-11-01', month: '2026-11' })).rejects.toThrow(
    ValidationError,
  );
});

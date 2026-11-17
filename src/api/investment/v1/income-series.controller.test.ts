import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { IncomeSeriesController } from './income-series.controller';
import { mocks, setup } from './income-series.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const accountId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';
const categoryId = '2d8c3a9e-5b6f-4d4c-8ebf-3a4b5c6d7e8f';
const userId = mocks.request.user.id;
const body = {
  accountId,
  amountPerUnit: '1.10',
  assetId: id,
  categoryId,
  exDateOffsetDays: 8,
  firstPaymentDate: '2025-01-15',
  frequency: { interval: 1, unit: 'MONTH' },
  markPastAsReceived: true,
  type: 'YIELD',
  withFinance: true,
};

it('SHOULD be served at /investments/income-series under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, IncomeSeriesController)).toBe(
    'investments/income-series',
  );
  expect(Reflect.getMetadata(VERSION_METADATA, IncomeSeriesController)).toBe('1');
});

it('SHOULD create AND preview after validating the strict body', async () => {
  await setup.create(mocks.request, body as never);
  await setup.preview(mocks.request, body as never);

  expect(mocks.service.create).toHaveBeenCalledWith(userId, body);
  expect(mocks.service.preview).toHaveBeenCalledWith(userId, body);
  await expect(setup.create(mocks.request, { ...body, extra: 1 } as never)).rejects.toThrow(
    ValidationError,
  );
  await expect(
    setup.create(mocks.request, { ...body, amountPerUnit: '1,1' } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD require account and category with finance AND refuse them without (spec 115 FR 1)', async () => {
  const { accountId: a, categoryId: c, ...noFinance } = body;

  void a;
  void c;
  await expect(
    setup.create(mocks.request, { ...body, accountId: undefined } as never),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.create(mocks.request, { ...noFinance, withFinance: false } as never),
  ).resolves.toBeDefined();
  await expect(
    setup.create(mocks.request, { ...body, withFinance: false } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD list by asset, read by id AND answer the projections with the validated query', async () => {
  await setup.list(mocks.request, { assetId: id });
  await setup.findById(mocks.request, id);
  await setup.projections(mocks.request, { from: '2026-12-01', to: '2027-01-31' });

  expect(mocks.service.list).toHaveBeenCalledWith(userId, id);
  expect(mocks.service.findById).toHaveBeenCalledWith(userId, id);
  expect(mocks.service.projections).toHaveBeenCalledWith(userId, {
    from: '2026-12-01',
    to: '2027-01-31',
  });
  await expect(setup.list(mocks.request, {})).rejects.toThrow(ValidationError);
  await expect(setup.projections(mocks.request, { from: 'x', to: 'y' })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD edit the series with a strict partial body', async () => {
  await setup.update(mocks.request, id, { amountPerUnit: '1.2', endDate: null } as never);

  expect(mocks.service.update).toHaveBeenCalledWith(userId, id, {
    amountPerUnit: '1.2',
    endDate: null,
  });
  await expect(setup.update(mocks.request, id, { assetId: id } as never)).rejects.toThrow(
    ValidationError,
  );
});

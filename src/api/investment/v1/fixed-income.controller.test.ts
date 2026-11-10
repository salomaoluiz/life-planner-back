import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { FixedIncomeController } from './fixed-income.controller';
import { mocks, setup } from './fixed-income.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const ownerId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';
const userId = mocks.request.user.id;
const prefixed = { annualRate: '12', mode: 'PREFIXED' };

it('SHOULD share the /investments prefix under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, FixedIncomeController)).toBe('investments');
  expect(Reflect.getMetadata(VERSION_METADATA, FixedIncomeController)).toBe('1');
});

it('SHOULD create a title after validating the body (strict, mode fields)', async () => {
  const body = {
    contribution: { amount: 1_000_000, date: '2026-01-02' },
    name: 'CDB',
    owner: 'USER',
    ownerId,
    rate: { cdiPercent: '110', indexRate: '14.90', mode: 'CDI_PERCENT' },
    terms: { liquidity: 'DAILY', maturityDate: '2030-01-02', product: 'CDB', taxExempt: false },
  };

  expect(await setup.createTitle(mocks.request, body as never)).toBe(mocks.result);
  expect(mocks.service.createTitle).toHaveBeenCalledWith(userId, body);
  await expect(
    setup.createTitle(mocks.request, { ...body, rate: { mode: 'CDI_PERCENT' } } as never),
  ).rejects.toThrow(ValidationError);
  await expect(setup.createTitle(mocks.request, { ...body, extra: 1 } as never)).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD validate the terms, contributions AND redemptions', async () => {
  await setup.upsertTerms(mocks.request, id, {
    liquidity: 'DAILY',
    maturityDate: '2030-01-02',
    product: 'CDB',
    taxExempt: false,
  } as never);
  await setup.createContribution(mocks.request, id, {
    amount: 500_000,
    date: '2026-10-20',
  } as never);
  await setup.createRedemption(mocks.request, id, {
    date: '2026-11-04',
    kind: 'PARTIAL',
    netAmount: 600_000,
  } as never);

  expect(mocks.service.upsertTerms).toHaveBeenCalled();
  expect(mocks.service.createContribution).toHaveBeenCalledWith(userId, id, {
    amount: 500_000,
    date: '2026-10-20',
  });
  expect(mocks.service.createRedemption).toHaveBeenCalled();
  await expect(
    setup.createContribution(mocks.request, id, { amount: 0, date: '2026-10-20' } as never),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.createRedemption(mocks.request, id, {
      date: '2026-11-04',
      kind: 'X',
      netAmount: 1,
    } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD create, update AND delete rates', async () => {
  const body = { ...prefixed, startDate: '2026-01-02' };

  await setup.createRate(mocks.request, id, body);
  await setup.updateRate(mocks.request, id, body);
  await setup.deleteRate(mocks.request, id);

  expect(mocks.service.createRate).toHaveBeenCalledWith(userId, id, body);
  expect(mocks.service.updateRate).toHaveBeenCalledWith(userId, id, body);
  expect(mocks.service.deleteRate).toHaveBeenCalledWith(userId, id);
  await expect(setup.createRate(mocks.request, id, prefixed)).rejects.toThrow(ValidationError);
});

it('SHOULD upsert an adjustment by date AND delete it', async () => {
  await setup.upsertAdjustment(mocks.request, id, '2026-07-01', { grossAmount: 1_100_000 });
  await setup.deleteAdjustment(mocks.request, id);

  expect(mocks.service.upsertAdjustment).toHaveBeenCalledWith(userId, id, '2026-07-01', {
    grossAmount: 1_100_000,
  });
  expect(mocks.service.deleteAdjustment).toHaveBeenCalledWith(userId, id);
  await expect(
    setup.upsertAdjustment(mocks.request, id, 'nope', { grossAmount: 1 }),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD simulate AND preview', async () => {
  await setup.simulate({
    amount: 1_000_000,
    date: '2026-01-02',
    maturityDate: '2028-01-03',
    rate: prefixed,
    taxExempt: false,
  } as never);
  await setup.previewRedemption(mocks.request, id, {
    date: '2026-11-04',
    kind: 'TOTAL',
    netAmount: 1_000_000,
  } as never);

  expect(mocks.service.simulate).toHaveBeenCalled();
  expect(mocks.service.previewRedemption).toHaveBeenCalledWith(userId, id, {
    date: '2026-11-04',
    kind: 'TOTAL',
    netAmount: 1_000_000,
  });
});

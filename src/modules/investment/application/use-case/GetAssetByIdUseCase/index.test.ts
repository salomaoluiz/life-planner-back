import { NotFoundException } from '@nestjs/common';

import {
  conversionScenario,
  operationFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.owners, id: mocks.asset.id };

it('SHOULD answer 404 for a missing asset or one the caller cannot reach', async () => {
  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD give each sell its realized result AND the position the spec expects', async () => {
  function buy(id: string, date: string, quantity: string, total: number) {
    return operationFixture({
      date,
      id,
      quantity: Decimal8.parse(quantity),
      total,
      type: InvestmentOperationType.BUY,
    });
  }
  const sell = operationFixture({
    date: '2026-09-15',
    id: 'sell',
    quantity: Decimal8.parse('300'),
    total: 326450,
    type: InvestmentOperationType.SELL,
  });
  spies.findAssetById.mockResolvedValue({
    ...mocks.asset,
    operations: [
      sell,
      buy('c', '2026-06-10', '500', 510650),
      buy('b', '2026-03-10', '500', 522650),
      buy('a', '2026-01-10', '500', 440000),
    ],
    valuations: [
      valuationFixture({ date: '2026-11-01', unitPrice: Decimal8.parse('10.53') }),
      valuationFixture({ date: '2026-10-01', unitPrice: Decimal8.parse('9') }),
    ],
  });

  const view = await setup.execute(base);

  expect(view.operations[0]).toMatchObject({ costRemoved: 294660, realizedResult: 31790 });
  expect(view.operations[1]).toMatchObject({ costRemoved: null, realizedResult: null });
  expect(view.position).toMatchObject({
    averagePrice: '9.82200000',
    cost: 1178640,
    currentValueDate: '2026-11-01',
    quantity: expect.objectContaining({ scaled: 120000000000n }),
    realizedResult: 31790,
  });
  expect(view.valuations).toHaveLength(2);
});

it('SHOULD carry the conversion links AND the counterpart of each conversion operation (spec 112)', async () => {
  const { conversion, destination, origin } = conversionScenario();

  spies.findAssetById.mockResolvedValue(origin);
  spies.findConversionsByAssetIds.mockResolvedValue([conversion]);

  const view = await setup.execute({ ...base, id: origin.id });

  expect(view.convertedTo).toMatchObject({ assetId: destination.id, ticker: 'BTHF11' });
  expect(view.operations.find((item) => item.operation.id === 'out-1')?.conversion).toMatchObject({
    assetId: destination.id,
    conversionId: 'conv-1',
    locked: false,
    ticker: 'BTHF11',
  });
  expect(view.position.quantity.isZero()).toBe(true);
});

it('SHOULD list where a destination came from AND its pending fraction', async () => {
  const { conversion, destination } = conversionScenario();

  spies.findAssetById.mockResolvedValue(destination);
  spies.findConversionsByAssetIds.mockResolvedValue([conversion]);

  const view = await setup.execute({ ...base, id: destination.id });

  expect(view.convertedFrom).toEqual([
    {
      assetId: conversion.fromAssetId,
      conversionId: 'conv-1',
      date: '2026-10-15',
      ticker: 'BCFF11',
    },
  ]);
  expect(view.position.quantity.toString()).toBe('762');
  expect(view.position.pendingFractions).toHaveLength(1);
});

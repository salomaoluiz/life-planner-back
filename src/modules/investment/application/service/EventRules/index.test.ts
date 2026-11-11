import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  assetFixture,
  operationFixture,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';
import { Decimal8 } from '@shared/infra/decimal';

import { assertEventsAllowed, persistEvent, previewEvent } from './index';

const spies = repositorySpies();
const asset = assetFixture({ ticker: 'MGLU3' });
const bought = operationFixture({
  assetId: asset.id,
  date: '2026-01-10',
  quantity: Decimal8.parse('3155'),
  total: 319100,
});
const draft = {
  assetId: asset.id,
  bonusPercent: null,
  bonusUnitCost: null,
  date: '2026-03-10',
  ratioFrom: Decimal8.parse('10'),
  ratioTo: Decimal8.parse('1'),
  type: InvestmentOperationType.REVERSE_SPLIT,
};
const event = operationFixture({
  assetId: asset.id,
  date: '2026-03-10',
  event: { kind: 'SPLIT', ratioFrom: Decimal8.parse('10'), ratioTo: Decimal8.parse('1') },
  id: 'event-1',
  quantity: Decimal8.zero(),
  total: 0,
  type: InvestmentOperationType.REVERSE_SPLIT,
  unitPrice: Decimal8.zero(),
});

beforeEach(() => jest.resetAllMocks());

describe('assertEventsAllowed', () => {
  it('SHOULD refuse a fixed income asset with 400', () => {
    expect(() =>
      assertEventsAllowed({ ...asset, assetClass: InvestmentAssetClass.FIXED_INCOME }),
    ).toThrow(new BadRequestException("Corporate events don't apply to fixed income"));
  });

  it('SHOULD allow every other class', () => {
    for (const assetClass of [
      InvestmentAssetClass.BR_STOCK,
      InvestmentAssetClass.BR_REIT,
      InvestmentAssetClass.FOREIGN_STOCK,
      InvestmentAssetClass.PRIVATE,
    ]) {
      expect(() => assertEventsAllowed({ ...asset, assetClass })).not.toThrow();
    }
  });
});

describe('persistEvent', () => {
  const detail = { ...asset, operations: [bought, event], valuations: [] };

  it('SHOULD write the event AND return its view with the before and after numbers', async () => {
    spies.writeEvent.mockResolvedValue('event-1');
    spies.findAssetById.mockResolvedValue(detail);

    const result = await persistEvent(spies as never, { ...asset, ...detail }, draft);

    expect(spies.writeEvent).toHaveBeenCalledWith(draft);
    expect(result.operation.operation.id).toBe('event-1');
    expect(result.operation.event?.quantityAfter.toString()).toBe('315');
    expect(result.asset.position.pendingFractions).toHaveLength(1);
  });

  it('SHOULD answer 422 WHEN no shares are held on the date', async () => {
    spies.writeEvent.mockRejectedValue(new NoPositionError('2026-03-10'));

    await expect(
      persistEvent(spies as never, { ...asset, ...detail }, draft),
    ).rejects.toMatchObject({
      response: { message: 'There is no position on 2026-03-10' },
      status: 422,
    });
  });

  it('SHOULD answer 422 WHEN a fraction sale would lose its fraction', async () => {
    spies.writeEvent.mockRejectedValue(new FractionSaleBreaksError('2026-04-04'));

    await expect(
      persistEvent(spies as never, { ...asset, ...detail }, draft),
    ).rejects.toMatchObject({
      status: 422,
    });
  });

  it('SHOULD answer 404 WHEN the written event cannot be read back', async () => {
    spies.writeEvent.mockResolvedValue('event-1');
    spies.findAssetById.mockResolvedValue(undefined);

    await expect(
      persistEvent(spies as never, { ...asset, ...detail }, draft),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('previewEvent', () => {
  const operations = [bought];

  it('SHOULD apply a reverse split to the position of the data-com', () => {
    const preview = previewEvent(operations, asset.assetClass, {
      bonusPercent: null,
      bonusUnitCost: null,
      ratioFrom: Decimal8.parse('10'),
      ratioTo: Decimal8.parse('1'),
      recordDate: '2026-03-10',
      type: InvestmentOperationType.REVERSE_SPLIT,
    });

    expect(preview).toMatchObject({
      averagePriceAfter: '10.11409524',
      averagePriceBefore: '1.01141046',
      fractionQuantity: Decimal8.parse('0.5'),
    });
    expect(preview?.quantityBefore.toString()).toBe('3155');
    expect(preview?.quantityAfter.toString()).toBe('315');
  });

  it('SHOULD apply a bonus with its unit cost AND ignore operations after the data-com', () => {
    const later = operationFixture({
      assetId: asset.id,
      date: '2026-12-01',
      quantity: Decimal8.parse('1000'),
      total: 1,
    });
    const preview = previewEvent(
      [operationFixture({ ...bought, quantity: Decimal8.parse('315'), total: 318594 }), later],
      asset.assetClass,
      {
        bonusPercent: Decimal8.parse('10'),
        bonusUnitCost: Decimal8.parse('4.5'),
        ratioFrom: null,
        ratioTo: null,
        recordDate: '2026-11-18',
        type: InvestmentOperationType.BONUS,
      },
    );

    expect(preview?.quantityAfter.toString()).toBe('346');
    expect(preview?.averagePriceAfter).toBe('9.61109827');
  });

  it('SHOULD return null WHEN no shares are held on the data-com', () => {
    expect(
      previewEvent([], asset.assetClass, {
        bonusPercent: null,
        bonusUnitCost: null,
        ratioFrom: Decimal8.parse('1'),
        ratioTo: Decimal8.parse('2'),
        recordDate: '2026-03-10',
        type: InvestmentOperationType.SPLIT,
      }),
    ).toBeNull();
  });
});

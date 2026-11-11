import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  operationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentFeeKind, InvestmentOperationType } from '@investment/domain/enum';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.owners, id: mocks.operation.id };
const linked = operationFixture({
  accountId: 'acc-1',
  assetId: mocks.asset.id,
  fees: [{ amount: 490, description: null, id: 'f1', kind: InvestmentFeeKind.BROKERAGE }],
  generateTransaction: true,
  id: 'op-linked',
  transactionId: 'tx-1',
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T12:00:00Z'));
  spies.findOperationById.mockResolvedValue(linked);
  spies.findAssetById.mockResolvedValue({ ...mocks.detail, operations: [linked] });
  spies.findAccountForOperation.mockResolvedValue(mocks.account);
  spies.writeOperation.mockResolvedValue('op-linked');
});

afterEach(() => jest.useRealTimers());

it('SHOULD keep what is not sent: fees, account, type AND recompute the totals', async () => {
  await setup.execute({ ...base, unitPrice: '11' });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      fees: [{ amount: 490, description: null, kind: 'BROKERAGE' }],
      feesTotal: 490,
      generateTransaction: true,
      gross: 550000,
      operationId: 'op-linked',
      total: 550490,
      type: 'BUY',
    }),
  );
});

it('SHOULD change date, quantity, fees AND the account', async () => {
  spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, id: 'acc-2' });

  await setup.execute({
    ...base,
    accountId: 'acc-2',
    date: '2026-06-01',
    fees: [],
    quantity: '400',
  });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-2',
      date: '2026-06-01',
      feesTotal: 0,
      gross: 408000,
    }),
  );
});

it('SHOULD drop the account WHEN generateTransaction is turned off', async () => {
  await setup.execute({ ...base, generateTransaction: false });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: null, generateTransaction: false }),
  );
});

it('SHOULD ask for an account WHEN turning generateTransaction on without one', async () => {
  const unlinked = operationFixture({ assetId: mocks.asset.id, id: 'op-unlinked' });
  spies.findOperationById.mockResolvedValue(unlinked);

  await expect(setup.execute({ ...base, generateTransaction: true })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(
    setup.execute({ ...base, accountId: 'acc-1', generateTransaction: true }),
  ).resolves.toBeDefined();
});

it('SHOULD answer 404 for a missing operation OR an asset the caller cannot reach', async () => {
  spies.findOperationById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 403 WHEN the linked account is one the caller cannot change', async () => {
  spies.findAccountForOperation.mockResolvedValueOnce({ ...mocks.account, ownerId: 'left-user' });

  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toThrow(
    new ForbiddenException("This operation uses an account you can't change"),
  );
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD answer 422 WHEN the edit would make the position negative', async () => {
  spies.writeOperation.mockRejectedValue(new NegativePositionError('2026-09-15', 'op-9'));

  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD reject an empty update', async () => {
  await expect(setup.execute(base)).rejects.toBeInstanceOf(ValidationError);
});

describe('on a calculated title (spec 105)', () => {
  const fixedDetail = fixedIncomeDetailFixture();
  const lot = fixedDetail.operations[0];

  beforeEach(() => {
    spies.findOperationById.mockResolvedValue(lot);
    spies.findAssetById.mockResolvedValue(fixedDetail);
    spies.findFixedIncomeByAssetIds.mockResolvedValue(
      new Map([['asset-fi', fixedIncomeDataFixture()]]),
    );
    spies.writeOperation.mockResolvedValue(lot.id);
  });

  const owners = [{ owner: 'USER' as never, ownerId: 'user-1' }];

  it('SHOULD rewrite a contribution from its amount AND date', async () => {
    const result = await setup.execute({ accessibleOwners: owners, amount: 700_000, id: lot.id });

    expect(spies.writeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        gross: 700_000,
        operationId: lot.id,
        total: 700_000,
        type: 'BUY',
      }),
    );
    expect(spies.writeOperation.mock.calls[0][0].quantity.toString()).toBe('7000');
    expect(result.operation.operation.id).toBe(lot.id);
  });

  it('SHOULD rewrite a redemption from its kind AND net', async () => {
    const sell = operationFixture({
      assetId: 'asset-fi',
      date: '2026-11-04',
      id: 'sell-1',
      netAmount: 600_000,
      redemptionKind: 'PARTIAL' as never,
      total: 600_000,
      type: 'SELL' as never,
    });

    spies.findOperationById.mockResolvedValue(sell);
    spies.findAssetById.mockResolvedValue({
      ...fixedDetail,
      operations: [sell, ...fixedDetail.operations],
    });
    spies.writeOperation.mockResolvedValue('sell-1');

    await setup.execute({
      accessibleOwners: owners,
      id: 'sell-1',
      kind: 'TOTAL' as never,
      netAmount: 650_000,
    });

    expect(spies.writeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        netAmount: 650_000,
        redemptionKind: 'TOTAL',
        total: 650_000,
        type: 'SELL',
      }),
    );
  });

  it('SHOULD refuse the generic fields with 400', async () => {
    await expect(
      setup.execute({ accessibleOwners: owners, id: lot.id, unitPrice: '2' }),
    ).rejects.toThrow(ValidationError);
    expect(spies.writeOperation).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a contribution moved before the first rate AND after the maturity', async () => {
    await expect(
      setup.execute({ accessibleOwners: owners, date: '2025-12-01', id: lot.id }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('SHOULD answer 422 with the redemption WHEN the edit makes it larger than the title', async () => {
    spies.writeOperation.mockRejectedValue(
      new FixedIncomeRedemptionTooLargeError('2026-11-04', 'sell-1'),
    );

    await expect(
      setup.execute({ accessibleOwners: owners, amount: 1_000, id: lot.id }),
    ).rejects.toMatchObject({ response: { details: { operationId: 'sell-1' } } });
  });
});

it('SHOULD refuse the fixed income fields on a regular asset', async () => {
  await expect(setup.execute({ ...base, netAmount: 500 })).rejects.toThrow(ValidationError);
});

describe('events and fraction sales (spec 108)', () => {
  const bought = operationFixture({
    assetId: mocks.asset.id,
    date: '2026-01-10',
    id: 'buy-1',
    quantity: Decimal8.parse('3155'),
    total: 319100,
  });
  const reverse = operationFixture({
    assetId: mocks.asset.id,
    date: '2026-03-10',
    event: { kind: 'SPLIT', ratioFrom: Decimal8.parse('10'), ratioTo: Decimal8.parse('1') },
    id: 'event-1',
    quantity: Decimal8.zero(),
    total: 0,
    type: InvestmentOperationType.REVERSE_SPLIT,
    unitPrice: Decimal8.zero(),
  });
  const bonus = operationFixture({
    assetId: mocks.asset.id,
    date: '2026-11-10',
    event: { kind: 'BONUS', percent: Decimal8.parse('10'), unitCost: Decimal8.parse('4.5') },
    id: 'bonus-1',
    quantity: Decimal8.zero(),
    total: 0,
    type: InvestmentOperationType.BONUS,
    unitPrice: Decimal8.zero(),
  });
  const sale = operationFixture({
    accountId: 'acc-1',
    assetId: mocks.asset.id,
    date: '2026-04-04',
    fractionOfOperationId: 'event-1',
    generateTransaction: true,
    gross: 520,
    id: 'sale-1',
    quantity: Decimal8.parse('0.5'),
    total: 520,
    transactionId: 'tx-1',
    type: InvestmentOperationType.SELL,
    unitPrice: Decimal8.parse('10.4'),
  });

  function load(operation: typeof reverse) {
    spies.findOperationById.mockResolvedValue(operation);
    spies.findAssetById.mockResolvedValue({
      ...mocks.detail,
      operations: [bought, reverse, bonus, sale],
    });
  }

  beforeEach(() => {
    spies.writeEvent.mockResolvedValue('event-1');
  });

  it('SHOULD change the date AND the ratio of an event, keeping its type', async () => {
    load(reverse);

    await setup.execute({ ...base, date: '2026-03-11', id: 'event-1', ratioFrom: '20' });

    const draft = spies.writeEvent.mock.calls[0][0];

    expect(draft).toMatchObject({
      date: '2026-03-11',
      operationId: 'event-1',
      type: InvestmentOperationType.REVERSE_SPLIT,
    });
    expect(draft.ratioFrom.toString()).toBe('20');
    expect(draft.ratioTo.toString()).toBe('1');
    expect(spies.writeOperation).not.toHaveBeenCalled();
  });

  it('SHOULD clear the unit cost of a bonus WHEN it is sent as null', async () => {
    load(bonus);
    spies.writeEvent.mockResolvedValue('bonus-1');

    await setup.execute({ ...base, bonusPercent: '5', bonusUnitCost: null, id: 'bonus-1' });

    const draft = spies.writeEvent.mock.calls[0][0];

    expect(draft.bonusPercent.toString()).toBe('5');
    expect(draft.bonusUnitCost).toBeNull();
  });

  it('SHOULD refuse BUY and SELL fields on an event with 400', async () => {
    load(reverse);

    for (const extra of [
      { quantity: '10' },
      { unitPrice: '2' },
      { fees: [] },
      { accountId: 'acc-1' },
      { generateTransaction: true },
      { grossAmount: 10 },
    ]) {
      await expect(setup.execute({ ...base, id: 'event-1', ...extra })).rejects.toBeInstanceOf(
        ValidationError,
      );
    }
  });

  it('SHOULD refuse a change that breaks the direction of the ratio or mixes a bonus in', async () => {
    load(reverse);

    await expect(
      setup.execute({ ...base, id: 'event-1', ratioFrom: '1', ratioTo: '4' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      setup.execute({ ...base, bonusPercent: '10', id: 'event-1' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('SHOULD answer 422 WHEN the edit leaves the fraction sale without a fraction', async () => {
    load(reverse);
    spies.writeEvent.mockRejectedValue(new FractionSaleBreaksError('2026-04-04'));

    await expect(
      setup.execute({ ...base, date: '2026-03-11', id: 'event-1' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('SHOULD change the amount, date AND fees of a fraction sale keeping quantity AND link', async () => {
    load(sale);
    spies.writeOperation.mockResolvedValue('sale-1');

    await setup.execute({
      ...base,
      date: '2026-04-06',
      fees: [{ amount: 20, kind: InvestmentFeeKind.BROKERAGE }],
      grossAmount: 600,
      id: 'sale-1',
    });

    expect(spies.writeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        date: '2026-04-06',
        feesTotal: 20,
        fractionOfOperationId: 'event-1',
        generateTransaction: true,
        gross: 600,
        operationId: 'sale-1',
        total: 580,
        type: InvestmentOperationType.SELL,
      }),
    );
    expect(spies.writeOperation.mock.calls[0][0].quantity.toString()).toBe('0.5');
    expect(spies.writeOperation.mock.calls[0][0].unitPrice.toString()).toBe('12');
  });

  it('SHOULD refuse quantity AND unit price of a fraction sale with 400', async () => {
    load(sale);

    await expect(setup.execute({ ...base, id: 'sale-1', quantity: '1' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(setup.execute({ ...base, id: 'sale-1', unitPrice: '1' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('SHOULD refuse a date before the event AND a zero amount with a finance entry', async () => {
    load(sale);

    await expect(
      setup.execute({ ...base, date: '2026-03-09', id: 'sale-1' }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(setup.execute({ ...base, grossAmount: 0, id: 'sale-1' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('SHOULD write the fraction off WHEN the amount is zero AND the finance entry is turned off', async () => {
    load(sale);
    spies.writeOperation.mockResolvedValue('sale-1');

    await setup.execute({ ...base, generateTransaction: false, grossAmount: 0, id: 'sale-1' });

    expect(spies.writeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: null, generateTransaction: false, gross: 0, total: 0 }),
    );
    expect(spies.writeOperation.mock.calls[0][0].unitPrice.toString()).toBe('0');
  });
});

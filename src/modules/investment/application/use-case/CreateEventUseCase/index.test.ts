import { NotFoundException } from '@nestjs/common';

import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  assetId: mocks.asset.id,
  date: '2026-03-10',
  ratioFrom: '10',
  ratioTo: '1',
  type: InvestmentOperationType.REVERSE_SPLIT as InvestmentOperationType.REVERSE_SPLIT,
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-11T12:00:00Z'));
  spies.findAssetById.mockResolvedValue(mocks.detail);
  spies.writeEvent.mockResolvedValue('event-1');
  quoteSpies.load.mockResolvedValue(undefined);
});

afterEach(() => jest.useRealTimers());

it('SHOULD write a reverse split AND return the event with its before and after', async () => {
  const result = await setup.execute(input);

  expect(spies.writeEvent).toHaveBeenCalledTimes(1);
  expect(spies.writeEvent.mock.calls[0][0]).toMatchObject({
    assetId: mocks.asset.id,
    bonusPercent: null,
    bonusUnitCost: null,
    date: '2026-03-10',
    type: InvestmentOperationType.REVERSE_SPLIT,
  });
  expect(spies.writeEvent.mock.calls[0][0].ratioFrom.toString()).toBe('10');
  expect(result.operation.operation.id).toBe('event-1');
  expect(result.operation.event?.quantityAfter.toString()).toBe('315');
});

it('SHOULD write a bonus with its unit cost', async () => {
  await setup.execute({
    accessibleOwners: mocks.owners,
    assetId: mocks.asset.id,
    bonusPercent: '10',
    bonusUnitCost: '4.50',
    date: '2026-11-10',
    type: InvestmentOperationType.BONUS,
  });

  const draft = spies.writeEvent.mock.calls[0][0];

  expect(draft.bonusPercent.toString()).toBe('10');
  expect(draft.bonusUnitCost.toString()).toBe('4.5');
  expect(draft.ratioFrom).toBeNull();
});

it('SHOULD answer 400 for a fixed income asset', async () => {
  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    assetClass: InvestmentAssetClass.FIXED_INCOME,
  });

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { message: "Corporate events don't apply to fixed income" },
    status: 400,
  });
  expect(spies.writeEvent).not.toHaveBeenCalled();
});

it('SHOULD answer 400 for a ratio in the wrong direction AND for BUY/SELL fields', async () => {
  await expect(setup.execute({ ...input, ratioFrom: '1', ratioTo: '10' })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(setup.execute({ ...input, quantity: '10' } as never)).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD answer 400 for a future date', async () => {
  await expect(setup.execute({ ...input, date: '2026-11-12' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD answer 404 for an asset the caller cannot reach', async () => {
  spies.findAssetById.mockResolvedValue({ ...mocks.detail, ownerId: 'someone-else' });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived family AND an archived asset', async () => {
  await expect(
    setup.execute({
      ...input,
      accessibleOwners: [{ archived: true, owner: OwnerType.USER, ownerId: 'user-1' }],
    }),
  ).rejects.toMatchObject({ status: 422 });

  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });

  await expect(setup.execute(input)).rejects.toMatchObject({ status: 422 });
});

it('SHOULD answer 422 WHEN no shares are held on the date AND write nothing else', async () => {
  spies.writeEvent.mockRejectedValue(new NoPositionError('2026-03-10'));

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { message: 'There is no position on 2026-03-10' },
    status: 422,
  });
});

it('SHOULD answer 422 with details WHEN a later sell of the old quantity depends on it', async () => {
  spies.writeEvent.mockRejectedValue(new NegativePositionError('2026-04-01', 'sell-1'));

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: {
      details: { date: '2026-04-01', operationId: 'sell-1' },
      message: 'This change would make the position negative on 2026-04-01',
    },
    status: 422,
  });
});

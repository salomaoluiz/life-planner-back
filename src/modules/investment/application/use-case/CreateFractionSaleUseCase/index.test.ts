import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import { InvestmentAssetStatus, InvestmentFeeKind } from '@investment/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  accountId: 'acc-1',
  date: '2026-04-04',
  eventId: 'event-1',
  grossAmount: 520,
};
const withSale = { ...mocks.detail, operations: [mocks.bought, mocks.event, mocks.sale] };

// The use case reads the asset twice before the write (the event's asset, then the writable check) and once after.
function readsAsset(before: object, after: object = withSale) {
  spies.findAssetById.mockReset();
  spies.findAssetById
    .mockResolvedValueOnce(before)
    .mockResolvedValueOnce(before)
    .mockResolvedValue(after);
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-11T12:00:00Z'));
  quoteSpies.load.mockResolvedValue(undefined);
  spies.findOperationById.mockResolvedValue(mocks.event);
  spies.findAccountForOperation.mockResolvedValue(mocks.account);
  spies.writeOperation.mockResolvedValue('sale-1');
  readsAsset(mocks.detail);
});

afterEach(() => jest.useRealTimers());

it('SHOULD sell the fraction as a SELL linked to its event with the auction amount as gross', async () => {
  const result = await setup.execute(input);
  const written = spies.writeOperation.mock.calls[0][0];

  expect(written).toMatchObject({
    accountId: 'acc-1',
    fractionOfOperationId: 'event-1',
    generateTransaction: true,
    gross: 520,
    total: 520,
    type: 'SELL',
  });
  expect(written.quantity.toString()).toBe('0.5');
  expect(written.unitPrice.toString()).toBe('10.4');
  expect(result.operation.costRemoved).toBe(506);
  expect(result.operation.realizedResult).toBe(14);
  expect(result.asset.position.pendingFractions).toEqual([]);
  expect(result.asset.position.quantity.toString()).toBe('315');
});

it('SHOULD subtract the fees from the total', async () => {
  await setup.execute({ ...input, fees: [{ amount: 20, kind: InvestmentFeeKind.BROKERAGE }] });

  expect(spies.writeOperation.mock.calls[0][0]).toMatchObject({
    feesTotal: 20,
    gross: 520,
    total: 500,
  });
});

it('SHOULD write the fraction off WHEN the amount is zero AND no finance entry is generated', async () => {
  await setup.execute({ ...input, accountId: null, generateTransaction: false, grossAmount: 0 });

  expect(spies.writeOperation.mock.calls[0][0]).toMatchObject({
    accountId: null,
    generateTransaction: false,
    gross: 0,
    total: 0,
  });
  expect(spies.writeOperation.mock.calls[0][0].unitPrice.toString()).toBe('0');
});

it('SHOULD answer 409 FRACTION_ALREADY_SOLD WHEN the event already has its sale', async () => {
  readsAsset(withSale);

  await expect(setup.execute(input)).rejects.toBeInstanceOf(ConflictException);

  readsAsset(withSale);

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { code: 'FRACTION_ALREADY_SOLD' },
  });
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD answer 422 WHEN the operation is not an event', async () => {
  spies.findOperationById.mockResolvedValue(mocks.bought);

  await expect(setup.execute({ ...input, eventId: 'buy-1' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD answer 422 WHEN the event left no fraction', async () => {
  readsAsset({
    ...mocks.detail,
    operations: [{ ...mocks.bought, quantity: Decimal8.parse('3150') }, mocks.event],
  });

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { message: 'This event has no fraction to sell' },
    status: 422,
  });
});

it('SHOULD answer 422 WHEN the sale is dated before the event', async () => {
  await expect(setup.execute({ ...input, date: '2026-03-09' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD answer 422 WHEN the fees are above the amount', async () => {
  await expect(
    setup.execute({ ...input, fees: [{ amount: 521, kind: InvestmentFeeKind.BROKERAGE }] }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD refuse an account the caller cannot use OR that is archived', async () => {
  spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, ownerId: 'someone-else' });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(ForbiddenException);

  readsAsset(mocks.detail);
  spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, archived: true });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD answer 404 for a missing event OR an unreachable asset', async () => {
  spies.findOperationById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

  readsAsset({ ...mocks.detail, ownerId: 'other' });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived asset', async () => {
  readsAsset({ ...mocks.detail, status: InvestmentAssetStatus.ARCHIVED });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD answer 400 for a finance entry without an account', async () => {
  await expect(setup.execute({ ...input, accountId: null })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

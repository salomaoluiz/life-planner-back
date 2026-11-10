import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import {
  InvestmentAssetStatus,
  InvestmentFeeKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  accountId: 'acc-1',
  assetId: mocks.asset.id,
  date: '2026-06-10',
  fees: [
    { amount: 490, kind: InvestmentFeeKind.BROKERAGE },
    { amount: 160, kind: InvestmentFeeKind.EXCHANGE_FEES },
  ],
  generateTransaction: true,
  quantity: '500',
  type: InvestmentOperationType.BUY,
  unitPrice: '10.20',
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T12:00:00Z'));
  spies.findAssetById.mockResolvedValue(mocks.detail);
  spies.findAccountForOperation.mockResolvedValue(mocks.account);
  spies.writeOperation.mockResolvedValue(mocks.operation.id);
});

afterEach(() => jest.useRealTimers());

it('SHOULD write the operation with totals computed from quantity, price AND fees', async () => {
  const result = await setup.execute(input);

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      assetLabel: 'ITSA4',
      currency: 'BRL',
      feesTotal: 650,
      generateTransaction: true,
      gross: 510000,
      operationId: undefined,
      total: 510650,
      type: 'BUY',
    }),
  );
  expect(result.operation.operation.id).toBe(mocks.operation.id);
  expect(result.asset.operationCount).toBe(1);
});

it('SHOULD subtract fees on a sell AND refuse fees above the sale', async () => {
  await setup.execute({
    ...input,
    fees: [{ amount: 550, kind: InvestmentFeeKind.BROKERAGE }],
    quantity: '300',
    type: InvestmentOperationType.SELL,
    unitPrice: '10.90',
  });
  expect(spies.writeOperation.mock.calls[0][0].total).toBe(326450);

  await expect(
    setup.execute({
      ...input,
      fees: [{ amount: 600, kind: InvestmentFeeKind.BROKERAGE }],
      quantity: '1',
      type: InvestmentOperationType.SELL,
      unitPrice: '5',
    }),
  ).rejects.toThrow(new UnprocessableEntityException('Fees are higher than the sale value'));
});

it('SHOULD skip the account WHEN no finance entry is generated', async () => {
  await setup.execute({ ...input, accountId: null, generateTransaction: false });

  expect(spies.findAccountForOperation).not.toHaveBeenCalled();
  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: null, generateTransaction: false }),
  );
});

it('SHOULD validate the input with 400', async () => {
  const bad = [
    { date: '2026-11-10' },
    { accountId: null },
    { accountId: 'acc-1', generateTransaction: false },
    { quantity: '0' },
    { quantity: '1.123456789' },
    { quantity: '10000000000' },
    { unitPrice: '-1' },
    { fees: [{ amount: 10, kind: InvestmentFeeKind.OTHER }] },
    { fees: [{ amount: 10, description: 'x', kind: InvestmentFeeKind.BROKERAGE }] },
    { fees: Array.from({ length: 11 }, () => ({ amount: 1, kind: InvestmentFeeKind.BROKERAGE })) },
  ];

  for (const override of bad) {
    await expect(setup.execute({ ...input, ...override })).rejects.toBeInstanceOf(ValidationError);
  }
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD default generateTransaction to true AND accept an OTHER fee with description', async () => {
  await setup.execute({
    ...input,
    fees: [{ amount: 100, description: 'Custody', kind: InvestmentFeeKind.OTHER }],
    generateTransaction: undefined,
  });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      fees: [{ amount: 100, description: 'Custody', kind: InvestmentFeeKind.OTHER }],
      generateTransaction: true,
    }),
  );
});

it('SHOULD answer 404 for an asset the caller cannot reach', async () => {
  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived asset OR an archived family', async () => {
  spies.findAssetById.mockResolvedValueOnce({
    ...mocks.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await expect(setup.execute(input)).rejects.toThrow(
    new UnprocessableEntityException("Archived assets can't change. Reactivate it first."),
  );

  spies.findAssetById.mockResolvedValueOnce({
    ...mocks.detail,
    owner: OwnerType.FAMILY,
    ownerId: 'fam',
  });
  await expect(
    setup.execute({
      ...input,
      accessibleOwners: [{ archived: true, owner: OwnerType.FAMILY, ownerId: 'fam' }],
    }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD refuse a missing, unreachable, archived or other-currency account', async () => {
  spies.findAccountForOperation.mockResolvedValueOnce(undefined);
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAccountForOperation.mockResolvedValueOnce({ ...mocks.account, ownerId: 'stranger' });
  await expect(setup.execute(input)).rejects.toBeInstanceOf(ForbiddenException);

  spies.findAccountForOperation.mockResolvedValueOnce({ ...mocks.account, archived: true });
  await expect(setup.execute(input)).rejects.toBeInstanceOf(UnprocessableEntityException);

  spies.findAccountForOperation.mockResolvedValueOnce({ ...mocks.account, currency: 'USD' });
  await expect(setup.execute(input)).rejects.toBeInstanceOf(UnprocessableEntityException);
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD accept a personal account for a family asset', async () => {
  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    owner: OwnerType.FAMILY,
    ownerId: 'fam',
  });

  await setup.execute({
    ...input,
    accessibleOwners: [...mocks.owners, { owner: OwnerType.FAMILY, ownerId: 'fam' }],
  });

  expect(spies.writeOperation).toHaveBeenCalled();
});

it('SHOULD answer 422 with the date and operation WHEN the position goes negative', async () => {
  spies.writeOperation.mockRejectedValue(new NegativePositionError('2026-09-15', 'op-9'));

  const error = await setup.execute(input).catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(UnprocessableEntityException);
  expect((error as UnprocessableEntityException).getResponse()).toEqual({
    details: { date: '2026-09-15', operationId: 'op-9' },
    message: 'This change would make the position negative on 2026-09-15',
  });
});

it('SHOULD rethrow an unknown write error AND fail WHEN the written operation cannot be re-read', async () => {
  spies.writeOperation.mockRejectedValueOnce(new Error('db down'));
  await expect(setup.execute(input)).rejects.toThrow('db down');

  spies.findAssetById.mockResolvedValueOnce(mocks.detail).mockResolvedValueOnce(undefined);
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce(mocks.detail);
  spies.writeOperation.mockResolvedValueOnce('another-id');
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD store the exchange rate of an operation on a foreign currency asset', async () => {
  spies.findAssetById.mockResolvedValue({ ...mocks.detail, currency: 'USD' });
  spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, currency: 'USD' });

  await setup.execute({ ...input, fxRate: '5.2236' });

  expect(spies.writeOperation).toHaveBeenCalledWith(expect.objectContaining({ fxRate: '5.2236' }));
});

it('SHOULD refuse an exchange rate on a BRL asset WITH code FX_RATE_NOT_ALLOWED', async () => {
  await expect(setup.execute({ ...input, fxRate: '5.2236' })).rejects.toMatchObject({
    response: { code: 'FX_RATE_NOT_ALLOWED' },
  });
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

describe('default exchange rate (spec 104 FR 27)', () => {
  beforeEach(() => {
    spies.findAssetById.mockResolvedValue({ ...mocks.detail, currency: 'USD' });
    spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, currency: 'USD' });
  });

  it('SHOULD use the rate of the operation date WHEN none is given', async () => {
    quoteSpies.findFxOnOrBefore.mockResolvedValue('5.4000');

    await setup.execute(input);

    expect(quoteSpies.findFxOnOrBefore).toHaveBeenCalledWith('USD-BRL', '2026-06-10');
    expect(spies.writeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ fxRate: '5.4000' }),
    );
  });

  it('SHOULD fall back to the latest rate, then to null', async () => {
    quoteSpies.findFxOnOrBefore.mockResolvedValue(undefined);
    quoteSpies.findFx.mockResolvedValueOnce({ rate: '5.5601' });
    await setup.execute(input);

    quoteSpies.findFx.mockResolvedValueOnce(undefined);
    await setup.execute(input);

    expect(spies.writeOperation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fxRate: '5.5601' }),
    );
    expect(spies.writeOperation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fxRate: null }),
    );
  });

  it('SHOULD keep an explicit null (no rate) AND not look the rate up', async () => {
    await setup.execute({ ...input, fxRate: null });

    expect(quoteSpies.findFxOnOrBefore).not.toHaveBeenCalled();
    expect(spies.writeOperation).toHaveBeenCalledWith(expect.objectContaining({ fxRate: null }));
  });

  it('SHOULD not look any rate up for a BRL asset', async () => {
    spies.findAssetById.mockResolvedValue(mocks.detail);
    spies.findAccountForOperation.mockResolvedValue(mocks.account);

    await setup.execute(input);

    expect(quoteSpies.findFxOnOrBefore).not.toHaveBeenCalled();
  });
});

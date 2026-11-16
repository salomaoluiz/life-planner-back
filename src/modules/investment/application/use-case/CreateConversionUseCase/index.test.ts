import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assetFixture, operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentAssetStatus } from '@investment/domain/enum';
import { ConversionLaterOperationsError } from '@investment/domain/error/ConversionLaterOperationsError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, quoteSpies, setup, spies } from './index.mocks';

const base = {
  accessibleOwners: mocks.owners,
  assetId: 'origin',
  date: '2026-10-15',
  ratioFrom: '1',
  ratioTo: '7.4',
};

function load(destinationOverrides = {}, originOverrides = {}) {
  const { conversion, destination, origin } = mocks.scenario();
  const active = {
    ...origin,
    archivedAt: null,
    id: 'origin',
    operations: [operationFixture({ assetId: 'origin' })],
    status: InvestmentAssetStatus.ACTIVE,
    ...originOverrides,
  };
  const target = { ...destination, id: 'dest', ...destinationOverrides };

  spies.findAssetById.mockImplementation(async (id: string) => (id === 'origin' ? active : target));
  spies.writeConversion.mockResolvedValue('conv-1');
  spies.findConversionById.mockResolvedValue({
    ...conversion,
    fromAssetId: 'origin',
    toAssetId: 'dest',
  });

  return { active, target };
}

describe('CreateConversionUseCase', () => {
  it('SHOULD convert into an existing asset AND return the item with both positions', async () => {
    load();

    const result = await setup.execute({ ...base, destination: { assetId: 'dest' } });

    expect(spies.writeConversion).toHaveBeenCalledWith({
      accountId: null,
      assetLabel: 'BCFF11',
      cashAmount: null,
      cashReferenceUnitValue: null,
      currency: 'BRL',
      date: '2026-10-15',
      destination: { assetId: 'dest' },
      fromAssetId: 'origin',
      generateTransaction: false,
      ratioFrom: Decimal8.parse('1'),
      ratioTo: Decimal8.parse('7.4'),
    });
    expect(result.item.id).toBe('conv-1');
    expect(result.toPosition.convertedFrom).toHaveLength(1);
    expect(result.fromPosition.convertedTo).toMatchObject({ ticker: 'BTHF11' });
  });

  it('SHOULD copy class, currency AND owner into a new destination AND validate its ticker', async () => {
    load();
    spies.findAssetByTicker.mockResolvedValue(undefined);

    await setup.execute({
      ...base,
      destination: { newAsset: { name: 'Fundo Exemplo', ticker: 'xpto11' } },
    });

    expect(quoteSpies.validate).toHaveBeenCalledWith(InvestmentAssetClass.BR_REIT, 'XPTO11');
    expect(spies.writeConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: {
          newAsset: expect.objectContaining({
            assetClass: InvestmentAssetClass.BR_REIT,
            currency: 'BRL',
            ownerId: 'user-1',
            ticker: 'XPTO11',
          }),
        },
      }),
    );
  });

  it('SHOULD answer 409 WHEN the new ticker already exists', async () => {
    load();
    spies.findAssetByTicker.mockResolvedValue(assetFixture());

    await expect(
      setup.execute({
        ...base,
        destination: { newAsset: { name: 'Fundo Exemplo', ticker: 'BTHF11' } },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('SHOULD refuse another class, another currency AND another owner with 400', async () => {
    load({ assetClass: InvestmentAssetClass.BR_STOCK });
    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toMatchObject({
      response: { message: 'A conversion needs two assets of the same class and currency' },
    });

    load({ currency: 'USD' });
    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toBeInstanceOf(BadRequestException);

    load({ ownerId: 'user-2' });
    await expect(
      setup.execute({
        ...base,
        accessibleOwners: [...mocks.owners, { owner: 'USER' as never, ownerId: 'user-2' }],
        destination: { assetId: 'dest' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SHOULD refuse fixed income AND the same asset with 400', async () => {
    load(
      { assetClass: InvestmentAssetClass.FIXED_INCOME },
      { assetClass: InvestmentAssetClass.FIXED_INCOME },
    );

    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toMatchObject({ response: { message: "Conversions don't apply to fixed income" } });

    load();
    await expect(
      setup.execute({ ...base, destination: { assetId: 'origin' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SHOULD refuse an archived destination with 422 AND an unreadable one with 404', async () => {
    load({ status: InvestmentAssetStatus.ARCHIVED });
    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toMatchObject({
      response: { message: "Archived assets can't receive a conversion" },
    });

    load({ ownerId: 'someone-else' });
    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD refuse an archived origin', async () => {
    load({}, { status: InvestmentAssetStatus.ARCHIVED });

    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SHOULD validate the account of a cash part AND pass it to the write', async () => {
    load();
    spies.findAccountForOperation.mockResolvedValue({
      archived: false,
      currency: 'BRL',
      id: 'acc-1',
      owner: 'USER',
      ownerId: 'user-1',
    });

    await setup.execute({
      ...base,
      accountId: 'acc-1',
      cashAmount: 1500,
      cashReferenceUnitValue: '10.4',
      destination: { assetId: 'dest' },
      generateTransaction: true,
    });

    expect(spies.writeConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        cashAmount: 1500,
        cashReferenceUnitValue: Decimal8.parse('10.4'),
        generateTransaction: true,
      }),
    );
  });

  it('SHOULD refuse 400 a cash part without reference value, a future date AND a ratio of zero', async () => {
    load();

    await expect(
      setup.execute({ ...base, cashAmount: 1500, destination: { assetId: 'dest' } }),
    ).rejects.toThrow();
    await expect(
      setup.execute({ ...base, date: '2999-01-01', destination: { assetId: 'dest' } }),
    ).rejects.toThrow();
    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' }, ratioTo: '0' }),
    ).rejects.toThrow();
  });

  it('SHOULD answer 422 WHEN the origin holds nothing on the date', async () => {
    load();
    spies.writeConversion.mockRejectedValue(new NoPositionError('2026-10-15'));

    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toMatchObject({ response: { message: 'There is no position on 2026-10-15' } });
  });

  it('SHOULD answer 422 listing the operations after the date', async () => {
    load();
    spies.writeConversion.mockRejectedValue(
      new ConversionLaterOperationsError('BCFF11', '2026-10-15', [
        { date: '2026-11-01', id: 'late', type: 'SELL' },
      ]),
    );

    await expect(
      setup.execute({ ...base, destination: { assetId: 'dest' } }),
    ).rejects.toMatchObject({
      response: {
        details: { date: '2026-10-15', operations: [{ id: 'late' }] },
        message: 'BCFF11 has operations after 2026-10-15. Delete them or pick another date.',
      },
    });
  });
});

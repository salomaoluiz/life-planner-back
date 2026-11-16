import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ConversionLaterOperationsError } from '@investment/domain/error/ConversionLaterOperationsError';
import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

function load(overrides: { locked?: boolean } = {}) {
  const { conversion, destination, origin } = mocks.scenario();

  spies.findConversionById.mockResolvedValue({ ...conversion, ...overrides });
  spies.findAssetById.mockImplementation(async (id: string) =>
    id === origin.id ? origin : destination,
  );
  spies.writeConversion.mockResolvedValue('conv-1');

  return { conversion, destination, origin };
}

describe('UpdateConversionUseCase', () => {
  it('SHOULD rewrite the conversion keeping the destination AND the fields not sent', async () => {
    const { destination } = load();

    const result = await setup.execute({
      accessibleOwners: mocks.owners,
      id: 'conv-1',
      ratioTo: '2',
    });

    expect(spies.writeConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        cashAmount: null,
        conversionId: 'conv-1',
        date: '2026-10-15',
        destination: { assetId: destination.id },
        generateTransaction: false,
        ratioFrom: Decimal8.parse('1'),
        ratioTo: Decimal8.parse('2'),
      }),
    );
    expect(result.item.id).toBe('conv-1');
  });

  it('SHOULD remove the cash part WHEN cashAmount is null', async () => {
    const { conversion } = load();

    spies.findConversionById.mockResolvedValue({
      ...conversion,
      cashAmount: 1500,
      cashReferenceUnitValue: Decimal8.parse('10.4'),
    });

    await setup.execute({ accessibleOwners: mocks.owners, cashAmount: null, id: 'conv-1' });

    expect(spies.writeConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: null,
        cashAmount: null,
        cashReferenceUnitValue: null,
        generateTransaction: false,
      }),
    );
  });

  it('SHOULD refuse a cash part without its reference value', async () => {
    load();

    await expect(
      setup.execute({ accessibleOwners: mocks.owners, cashAmount: 1500, id: 'conv-1' }),
    ).rejects.toThrow();
    expect(spies.writeConversion).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a changed destination', async () => {
    load();

    await expect(
      setup.execute({
        accessibleOwners: mocks.owners,
        destination: { assetId: 'other' } as never,
        id: 'conv-1',
      }),
    ).rejects.toThrow();
  });

  it('SHOULD refuse 422 CONVERSION_CHAIN_LOCKED in the middle of a chain', async () => {
    load({ locked: true });

    await expect(
      setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1', ratioTo: '2' }),
    ).rejects.toMatchObject({ response: { code: 'CONVERSION_CHAIN_LOCKED' } });
  });

  it('SHOULD answer 404 for a conversion of another owner', async () => {
    load();

    await expect(
      setup.execute({
        accessibleOwners: [{ owner: 'USER' as never, ownerId: 'other' }],
        id: 'conv-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD answer 422 with the operations WHEN the new date leaves later operations', async () => {
    load();
    spies.writeConversion.mockRejectedValue(
      new ConversionLaterOperationsError('BCFF11', '2026-10-01', [
        { date: '2026-10-10', id: 'x', type: 'SELL' },
      ]),
    );

    await expect(
      setup.execute({ accessibleOwners: mocks.owners, date: '2026-10-01', id: 'conv-1' }),
    ).rejects.toMatchObject({
      response: { details: { operations: [{ id: 'x' }] } },
    });
  });

  it('SHOULD answer 422 WHEN the edit would remove the sold fraction', async () => {
    load();
    spies.writeConversion.mockRejectedValue(new FractionSaleBreaksError('2026-10-20'));

    await expect(
      setup.execute({ accessibleOwners: mocks.owners, id: 'conv-1', ratioTo: '1' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

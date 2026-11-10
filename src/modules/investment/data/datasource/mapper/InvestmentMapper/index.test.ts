import { Prisma } from '@db/client';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';

import { InvestmentMapper } from './index';

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

describe('InvestmentMapper', () => {
  it('SHOULD round-trip calendar dates', () => {
    const date = InvestmentMapper.fromCalendarDate('2026-06-10');

    expect(date.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    expect(InvestmentMapper.toCalendarDate(date)).toBe('2026-06-10');
  });

  it('SHOULD read numeric columns as exact decimals', () => {
    expect(InvestmentMapper.toDecimal(decimal('18.3572')).toFixed8()).toBe('18.35720000');
    expect(InvestmentMapper.toDecimal(decimal('9999999999.99999999')).toFixed8()).toBe(
      '9999999999.99999999',
    );
  });

  it('SHOULD map an asset', () => {
    const asset = InvestmentMapper.toAsset({
      archived_at: null,
      asset_class: 'BR_STOCK',
      created_at: new Date('2026-01-01T00:00:00Z'),
      currency: 'BRL',
      id: 'id',
      name: 'Name',
      owner: 'FAMILY',
      owner_id: 'owner',
      status: 'ACTIVE',
      ticker: 'ITSA4',
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });

    expect(asset).toMatchObject({
      assetClass: InvestmentAssetClass.BR_STOCK,
      ownerId: 'owner',
      status: 'ACTIVE',
      ticker: 'ITSA4',
    });
  });

  it('SHOULD map an operation with its fees AND a valuation', () => {
    const operation = InvestmentMapper.toOperation({
      account_id: 'acc',
      asset_id: 'asset',
      created_at: new Date('2026-01-01T00:00:00Z'),
      date: new Date('2026-06-10T00:00:00Z'),
      fees: [{ amount: 490, description: null, id: 'f', kind: 'BROKERAGE', operation_id: 'op' }],
      fees_total: 490,
      fx_rate: null,
      generate_transaction: true,
      gross: 510000,
      id: 'op',
      net_amount: null,
      quantity: decimal('500'),
      redemption_kind: null,
      total: 510490,
      transaction_id: 'tx',
      type: 'BUY',
      unit_price: decimal('10.2'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });

    expect(operation).toMatchObject({
      date: '2026-06-10',
      fees: [{ amount: 490, kind: 'BROKERAGE' }],
      transactionId: 'tx',
      type: InvestmentOperationType.BUY,
    });
    expect(operation.quantity.toString()).toBe('500');
    expect(operation.unitPrice.toFixed8()).toBe('10.20000000');

    const valuation = InvestmentMapper.toValuation({
      asset_id: 'asset',
      created_at: new Date(),
      date: new Date('2026-11-01T00:00:00Z'),
      id: 'v',
      source: 'MANUAL',
      unit_price: decimal('10.53'),
      updated_at: new Date(),
    });

    expect(valuation).toMatchObject({ date: '2026-11-01', source: 'MANUAL' });
  });
});

import { Prisma } from '@db/client';
import { InvestmentCorporateEventType, InvestmentSuggestionStatus } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

import { CorporateEventMapper } from './index';

const row = {
  bonus_percent: null,
  bonus_unit_cost: null,
  currency: 'BRL',
  event_key: 'brapi:MGLU3:REVERSE_SPLIT:2026-03-10',
  fetched_at: new Date('2026-11-11T22:00:00Z'),
  id: 'ev-1',
  market: 'B3' as const,
  ratio_from: new Prisma.Decimal('10'),
  ratio_to: new Prisma.Decimal('1'),
  record_date: new Date('2026-03-10T00:00:00Z'),
  source: 'brapi',
  ticker: 'MGLU3',
  type: 'REVERSE_SPLIT' as const,
};

describe('CorporateEventMapper', () => {
  it('SHOULD map an event with shortest decimals AND a calendar day', () => {
    expect(CorporateEventMapper.toEvent(row)).toEqual({
      bonusPercent: null,
      bonusUnitCost: null,
      currency: 'BRL',
      id: 'ev-1',
      market: QuoteMarket.B3,
      ratioFrom: '10',
      ratioTo: '1',
      recordDate: '2026-03-10',
      ticker: 'MGLU3',
      type: InvestmentCorporateEventType.REVERSE_SPLIT,
    });
  });

  it('SHOULD map a bonus with its percent AND unit cost', () => {
    const event = CorporateEventMapper.toEvent({
      ...row,
      bonus_percent: new Prisma.Decimal('10'),
      bonus_unit_cost: new Prisma.Decimal('4.5'),
      ratio_from: null,
      ratio_to: null,
      type: 'BONUS',
    });

    expect(event).toMatchObject({ bonusPercent: '10', bonusUnitCost: '4.5', ratioFrom: null });
  });

  it('SHOULD map a suggestion with its event AND status', () => {
    const suggestion = CorporateEventMapper.toSuggestion({
      asset_id: 'asset-1',
      created_at: new Date('2026-11-19T00:00:00Z'),
      decided_at: null,
      decided_by: null,
      event: row,
      event_id: 'ev-1',
      id: 'sug-1',
      quantity: new Prisma.Decimal('315'),
      status: 'PENDING',
    });

    expect(suggestion).toMatchObject({
      assetId: 'asset-1',
      eventId: 'ev-1',
      id: 'sug-1',
      quantity: '315',
      status: InvestmentSuggestionStatus.PENDING,
    });
    expect(suggestion.event.ticker).toBe('MGLU3');
  });
});

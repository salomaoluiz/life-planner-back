import { ConflictException, NotFoundException } from '@nestjs/common';

import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import { InvestmentSuggestionStatus } from '@investment/domain/enum';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

const input = { accessibleOwners: mocks.owners, id: 'sug-1', userId: 'user-1' };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-19T12:00:00Z'));
  quoteSpies.load.mockResolvedValue(undefined);
  spies.events.findSuggestionById.mockResolvedValue(mocks.suggestion);
  spies.investment.findAssetById.mockResolvedValue(mocks.detail);
  spies.investment.writeEvent.mockResolvedValue('event-1');
});

afterEach(() => jest.useRealTimers());

it('SHOULD create the event of the suggestion linking it AND who decided', async () => {
  const result = await setup.execute(input);
  const draft = spies.investment.writeEvent.mock.calls[0][0];

  expect(draft).toMatchObject({
    assetId: mocks.asset.id,
    date: '2026-11-18',
    decidedBy: 'user-1',
    eventSuggestionId: 'sug-1',
    ratioFrom: null,
    ratioTo: null,
    type: 'BONUS',
  });
  expect(draft.bonusPercent.toString()).toBe('10');
  expect(draft.bonusUnitCost.toString()).toBe('4.5');
  expect(result.operation.operation.id).toBe('event-1');
});

it('SHOULD save the values of the owner WHEN the suggestion is edited', async () => {
  await setup.execute({ ...input, bonusPercent: '5', date: '2026-11-17' });

  const draft = spies.investment.writeEvent.mock.calls[0][0];

  expect(draft.bonusPercent.toString()).toBe('5');
  expect(draft.bonusUnitCost.toString()).toBe('4.5');
  expect(draft.date).toBe('2026-11-17');
});

it('SHOULD clear the unit cost WHEN it is sent as null', async () => {
  await setup.execute({ ...input, bonusUnitCost: null });

  expect(spies.investment.writeEvent.mock.calls[0][0].bonusUnitCost).toBeNull();
});

it('SHOULD take only the new fields WHEN the owner changes the type', async () => {
  await setup.execute({ ...input, ratioFrom: '1', ratioTo: '4', type: 'SPLIT' as never });

  const draft = spies.investment.writeEvent.mock.calls[0][0];

  expect(draft).toMatchObject({ bonusPercent: null, bonusUnitCost: null, type: 'SPLIT' });
  expect(draft.ratioTo.toString()).toBe('4');
});

it('SHOULD answer 400 WHEN the changed type lacks its fields', async () => {
  await expect(setup.execute({ ...input, type: 'SPLIT' as never })).rejects.toBeInstanceOf(
    ValidationError,
  );
  expect(spies.investment.writeEvent).not.toHaveBeenCalled();
});

it('SHOULD answer 409 WHEN the suggestion is no longer pending', async () => {
  spies.events.findSuggestionById.mockResolvedValue({
    ...mocks.suggestion,
    status: InvestmentSuggestionStatus.REJECTED,
  });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(ConflictException);
  expect(spies.investment.writeEvent).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for a missing suggestion OR an asset the caller cannot reach', async () => {
  spies.events.findSuggestionById.mockResolvedValueOnce(null);
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValue({ ...mocks.detail, ownerId: 'someone-else' });
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived family', async () => {
  await expect(
    setup.execute({
      ...input,
      accessibleOwners: [{ archived: true, owner: OwnerType.USER, ownerId: 'user-1' }],
    }),
  ).rejects.toMatchObject({ status: 422 });
});

it('SHOULD answer 422 AND leave the suggestion pending WHEN the position would break', async () => {
  spies.investment.writeEvent.mockRejectedValue(new NegativePositionError('2026-12-01', 'sell-1'));

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { details: { date: '2026-12-01', operationId: 'sell-1' } },
    status: 422,
  });
  expect(spies.events.rejectSuggestion).not.toHaveBeenCalled();
});

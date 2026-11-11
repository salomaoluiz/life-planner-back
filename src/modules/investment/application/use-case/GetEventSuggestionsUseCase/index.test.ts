import { NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

const input = { accessibleOwners: mocks.owners, assetId: mocks.asset.id };

beforeEach(() => {
  spies.investment.findAssetById.mockResolvedValue(mocks.detail);
  spies.investment.findAssetsByOwners.mockResolvedValue([
    { ...mocks.asset, latestValuation: null, operations: [mocks.bought] },
  ]);
  spies.events.findPendingSuggestions.mockResolvedValue([mocks.reverseSuggestion]);
});

it('SHOULD list the pending suggestions of an asset with the preview of the event', async () => {
  const result = await setup.execute(input);

  expect(spies.events.findPendingSuggestions).toHaveBeenCalledWith(
    [mocks.asset.id],
    201,
    undefined,
  );
  expect(result.nextCursor).toBeNull();
  expect(result.items).toEqual([
    {
      assetId: mocks.asset.id,
      averagePriceAfter: '10.11409524',
      averagePriceBefore: '1.01141046',
      bonusPercent: null,
      bonusUnitCost: null,
      currency: 'BRL',
      date: '2026-03-10',
      fractionQuantity: '0.5',
      id: 'sug-reverse',
      quantity: '3155',
      quantityAfter: '315',
      quantityBefore: '3155',
      ratioFrom: '10',
      ratioTo: '1',
      ticker: 'MGLU3',
      type: 'REVERSE_SPLIT',
    },
  ]);
});

it('SHOULD preview a bonus with its unit cost', async () => {
  spies.events.findPendingSuggestions.mockResolvedValue([mocks.bonusSuggestion]);
  const [item] = (await setup.execute(input)).items;

  expect(item).toMatchObject({
    bonusPercent: '10',
    bonusUnitCost: '4.5',
    quantityAfter: '3470',
    quantityBefore: '3155',
    type: 'BONUS',
  });
});

it('SHOULD skip a suggestion whose position is gone', async () => {
  spies.investment.findAssetById.mockResolvedValue({ ...mocks.detail, operations: [] });

  expect((await setup.execute(input)).items).toEqual([]);
});

it('SHOULD cap the page AND return the cursor of the next one', async () => {
  const many = Array.from({ length: 3 }, (_, index) => ({
    ...mocks.reverseSuggestion,
    id: `sug-${index}`,
  }));

  spies.events.findPendingSuggestions.mockResolvedValue(many);

  const result = await setup.execute({ ...input, limit: 2 });

  expect(spies.events.findPendingSuggestions).toHaveBeenCalledWith([mocks.asset.id], 3, undefined);
  expect(result.items.map((item) => item.id)).toEqual(['sug-0', 'sug-1']);
  expect(result.nextCursor).toBe('sug-1');
});

it('SHOULD continue after a cursor', async () => {
  await setup.execute({ ...input, cursor: 'sug-9' });

  expect(spies.events.findPendingSuggestions).toHaveBeenCalledWith([mocks.asset.id], 201, 'sug-9');
});

it('SHOULD list every readable asset WHEN no asset is given, narrowed by owner', async () => {
  await setup.execute({
    accessibleOwners: [...mocks.owners, { owner: OwnerType.FAMILY, ownerId: 'family-1' }],
    owner: 'USER',
  });

  expect(spies.investment.findAssetsByOwners).toHaveBeenCalledWith(mocks.owners, 'ACTIVE');
});

it('SHOULD answer 404 for an asset the caller cannot read', async () => {
  spies.investment.findAssetById.mockResolvedValue({ ...mocks.detail, ownerId: 'someone-else' });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD ignore a suggestion of an asset that is not in the readable set', async () => {
  spies.events.findPendingSuggestions.mockResolvedValue([
    { ...mocks.reverseSuggestion, assetId: 'unknown' },
  ]);

  expect((await setup.execute(input)).items).toEqual([]);
});

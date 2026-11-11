import { ConflictException, NotFoundException } from '@nestjs/common';

import { incomeSuggestionFixture } from '@investment/domain/entity/mocks/income.fixture';
import { InvestmentSuggestionStatus } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: 'sug-1', userId: 'user-1' };

beforeEach(() => {
  spies.incomes.findSuggestionById.mockResolvedValue(
    incomeSuggestionFixture({ assetId: scenario.asset.id, id: 'sug-1' }),
  );
});

it('SHOULD reject the suggestion for the user', async () => {
  await setup.execute(base);

  expect(spies.incomes.rejectSuggestion).toHaveBeenCalledWith('sug-1', 'user-1');
});

it('SHOULD answer 404 for an unknown suggestion OR an asset out of reach', async () => {
  spies.incomes.findSuggestionById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 409 WHEN the suggestion is no longer pending', async () => {
  spies.incomes.findSuggestionById.mockResolvedValue(
    incomeSuggestionFixture({
      assetId: scenario.asset.id,
      status: InvestmentSuggestionStatus.REJECTED,
    }),
  );

  await expect(setup.execute(base)).rejects.toBeInstanceOf(ConflictException);
  expect(spies.incomes.rejectSuggestion).not.toHaveBeenCalled();
});

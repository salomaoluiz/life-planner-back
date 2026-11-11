import { ConflictException, NotFoundException } from '@nestjs/common';

import { InvestmentSuggestionStatus } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

const input = { accessibleOwners: mocks.owners, id: 'sug-1', userId: 'user-1' };

beforeEach(() => {
  spies.events.findSuggestionById.mockResolvedValue(mocks.suggestion);
  spies.investment.findAssetById.mockResolvedValue(mocks.detail);
});

it('SHOULD reject the suggestion for good, recording who decided', async () => {
  await setup.execute(input);

  expect(spies.events.rejectSuggestion).toHaveBeenCalledWith('sug-1', 'user-1');
});

it('SHOULD answer 409 WHEN it is not pending anymore', async () => {
  spies.events.findSuggestionById.mockResolvedValue({
    ...mocks.suggestion,
    status: InvestmentSuggestionStatus.APPROVED,
  });

  await expect(setup.execute(input)).rejects.toBeInstanceOf(ConflictException);
  expect(spies.events.rejectSuggestion).not.toHaveBeenCalled();
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

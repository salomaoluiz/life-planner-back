import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { AccountStatus } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

describe('GetCreditCardsUseCase', () => {
  it('SHOULD order ACTIVE first, then title case-insensitively', async () => {
    const banana = new CreditCardEntityFixture().withTitle('banana').build();
    const apple = new CreditCardEntityFixture().withTitle('Apple').build();
    const archived = new CreditCardEntityFixture()
      .withTitle('Aaa')
      .withStatus(AccountStatus.ARCHIVED)
      .build();
    mocks.creditCardRepository.findCreditCards.mockResolvedValueOnce([archived, banana, apple]);

    const result = await setup.execute({ accessibleOwners: mocks.input.accessibleOwners });

    expect(result.map((card) => card.title)).toEqual(['Apple', 'banana', 'Aaa']);
  });

  it('SHOULD pass the status filter to the repository', async () => {
    await setup.execute({
      accessibleOwners: mocks.input.accessibleOwners,
      status: AccountStatus.ARCHIVED,
    });

    expect(mocks.creditCardRepository.findCreditCards).toHaveBeenCalledWith(
      mocks.input.accessibleOwners,
      'ARCHIVED',
    );
  });

  it('SHOULD narrow by ownerIds AND drop ids the caller cannot access', async () => {
    await setup.execute({
      accessibleOwners: mocks.input.accessibleOwners,
      ownerIds: [mocks.input.ownerId, 'foreign'],
    });

    expect(mocks.creditCardRepository.findCreditCards).toHaveBeenCalledWith(
      mocks.input.accessibleOwners,
      undefined,
    );
  });

  it('SHOULD return [] WITHOUT hitting the repository WHEN no owner remains', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.input.accessibleOwners,
      ownerIds: ['foreign'],
    });

    expect(result).toEqual([]);
    expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
  });
});

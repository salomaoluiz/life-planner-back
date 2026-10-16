import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('GetCreditCardsOverviewUseCase', () => {
  it('SHOULD fetch only ACTIVE cards of the accessible owners', async () => {
    await setup.execute(mocks.input);

    expect(mocks.creditCardRepository.findCreditCards).toHaveBeenCalledWith(
      mocks.input.accessibleOwners,
      'ACTIVE',
    );
  });

  it('SHOULD return every card with its open and upcoming invoices, sorted by title', async () => {
    const result = await setup.execute(mocks.input);

    expect(result.cards.map((item) => item.card.title)).toEqual(['alpha', 'Zeta']);
    expect(result.cards[0].openInvoice).toMatchObject({ amount: 0, status: 'OPEN' });
    expect(result.cards[0].upcomingInvoices.map((invoice) => invoice.referenceMonth)).toEqual([
      '2026-11',
    ]);
    expect(result.cards[0].used).toBe(4000);
    expect(result.cards[0].available).toBe(496000);
    expect(mocks.compute.execute).toHaveBeenCalledTimes(1);
  });

  it('SHOULD aggregate limit, used and available over the returned cards', async () => {
    const result = await setup.execute(mocks.input);

    expect(result.aggregate).toEqual({ available: 792000, totalLimit: 800000, used: 8000 });
  });

  it('SHOULD narrow by ownerIds AND drop owners the caller cannot access', async () => {
    await setup.execute({
      ...mocks.input,
      ownerIds: [mocks.input.accessibleOwners[0].ownerId, 'foreign'],
    });

    expect(mocks.creditCardRepository.findCreditCards).toHaveBeenCalledWith(
      [mocks.input.accessibleOwners[0]],
      'ACTIVE',
    );
  });

  it('SHOULD return an empty overview WITHOUT hitting the repository WHEN no owner remains', async () => {
    const result = await setup.execute({ ...mocks.input, ownerIds: ['foreign'] });

    expect(result).toEqual({ aggregate: { available: 0, totalLimit: 0, used: 0 }, cards: [] });
    expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
  });

  it('SHOULD return an empty overview WHEN there are no cards', async () => {
    mocks.creditCardRepository.findCreditCards.mockResolvedValueOnce([]);

    expect((await setup.execute(mocks.input)).cards).toEqual([]);
  });

  it('SHOULD reject a malformed today', async () => {
    await expect(setup.execute({ ...mocks.input, today: '15/10/2026' })).rejects.toThrow();
    await expect(setup.execute({ ...mocks.input, today: '2026-02-30' })).rejects.toThrow();
  });

  it('SHOULD keep personal cards of other users out WHEN only the family is accessible (spouse example)', async () => {
    mocks.creditCardRepository.findCreditCards.mockImplementationOnce(async (owners) =>
      [mocks.personalCard, mocks.familyCard].filter((card) =>
        owners.some(
          (owner: { owner: OwnerType; ownerId: string }) =>
            owner.owner === card.owner && owner.ownerId === card.ownerId,
        ),
      ),
    );

    const result = await setup.execute({
      accessibleOwners: [{ owner: OwnerType.FAMILY, ownerId: mocks.familyCard.ownerId }],
      today: '2026-10-15',
    });

    expect(result.cards.map((item) => item.card.id)).toEqual([mocks.familyCard.id]);
  });
});

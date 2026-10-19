import { ConflictException, NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('DeleteCreditCardUseCase', () => {
  it('SHOULD delete the card WHEN the caller has access to the owner', async () => {
    await setup.execute(mocks.base);

    expect(mocks.creditCardRepository.deleteCreditCard).toHaveBeenCalledWith(mocks.card.id);
  });

  it('SHOULD throw NotFound WHEN the card does not exist', async () => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);

    await expect(setup.execute(mocks.base)).rejects.toThrow(NotFoundException);
    expect(mocks.creditCardRepository.deleteCreditCard).not.toHaveBeenCalled();
  });

  it("SHOULD throw NotFound WHEN the card is someone else's personal card", async () => {
    await expect(
      setup.execute({
        ...mocks.base,
        accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'spouse' }],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.creditCardRepository.deleteCreditCard).not.toHaveBeenCalled();
  });

  it('SHOULD throw Conflict (409) AND delete nothing WHEN the card has transactions', async () => {
    mocks.transactionRepository.countByCreditCardId.mockResolvedValueOnce(2);

    await expect(setup.execute(mocks.base)).rejects.toThrow(
      new ConflictException('Credit card has transactions'),
    );
    expect(mocks.creditCardRepository.deleteCreditCard).not.toHaveBeenCalled();
  });
});

describe('recurring transactions (spec 034)', () => {
  it('SHOULD answer 409 AND delete nothing WHEN the card has series', async () => {
    mocks.recurrenceRepository.countBySource.mockResolvedValue(2);

    await expect(setup.execute(mocks.base)).rejects.toThrow(
      'Credit card has recurring transactions',
    );
    expect(mocks.recurrenceRepository.countBySource).toHaveBeenCalledWith({
      creditCardId: mocks.card.id,
    });
    expect(mocks.creditCardRepository.deleteCreditCard).not.toHaveBeenCalled();
  });
});

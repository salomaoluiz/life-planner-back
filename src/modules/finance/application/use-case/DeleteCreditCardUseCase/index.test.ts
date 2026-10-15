import { NotFoundException } from '@nestjs/common';

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
});

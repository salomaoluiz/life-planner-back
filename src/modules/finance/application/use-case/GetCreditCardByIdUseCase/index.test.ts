import { NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('GetCreditCardByIdUseCase', () => {
  it('SHOULD return the card WHEN the caller has access', async () => {
    expect(await setup.execute(mocks.base)).toBe(mocks.card);
  });

  it('SHOULD throw NotFound WHEN missing', async () => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);

    await expect(setup.execute(mocks.base)).rejects.toThrow(NotFoundException);
  });

  it('SHOULD throw NotFound WHEN the card is not accessible', async () => {
    await expect(
      setup.execute({
        ...mocks.base,
        accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'spouse' }],
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

import { ForbiddenException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('CreateCreditCardUseCase', () => {
  it('SHOULD create the card with status ACTIVE by default AND return it', async () => {
    const result = await setup.execute(mocks.input);

    expect(mocks.creditCardRepository.createCreditCard).toHaveBeenCalledWith({
      brand: 'VISA',
      closingDay: 31,
      color: '#3B5BDB',
      dueDay: 10,
      lastDigits: undefined,
      limit: 500000,
      owner: 'USER',
      ownerId: mocks.input.ownerId,
      paymentDay: undefined,
      status: 'ACTIVE',
      title: 'Main card',
    });
    expect(result).toBe(mocks.card);
  });

  it('SHOULD trim the title AND keep optional lastDigits / paymentDay', async () => {
    await setup.execute({
      ...mocks.input,
      lastDigits: '1234',
      paymentDay: 5,
      title: '  Main card  ',
    });

    expect(mocks.creditCardRepository.createCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ lastDigits: '1234', paymentDay: 5, title: 'Main card' }),
    );
  });

  it('SHOULD allow a family owner WHEN the caller belongs to it', async () => {
    const familyId = 'family-uuid';

    await setup.execute({
      ...mocks.input,
      accessibleOwners: [
        ...mocks.input.accessibleOwners,
        { owner: OwnerType.FAMILY, ownerId: familyId },
      ],
      owner: OwnerType.FAMILY,
      ownerId: familyId,
    });

    expect(mocks.creditCardRepository.createCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'FAMILY', ownerId: familyId }),
    );
  });

  it('SHOULD throw Forbidden AND not persist WHEN the owner is not accessible', async () => {
    await expect(setup.execute({ ...mocks.input, ownerId: 'someone-else' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(mocks.creditCardRepository.createCreditCard).not.toHaveBeenCalled();
  });

  it.each([
    ['closing day 0', { closingDay: 0 }],
    ['closing day 32', { closingDay: 32 }],
    ['due day 0', { dueDay: 0 }],
    ['payment day 32', { paymentDay: 32 }],
    ['limit 0', { limit: 0 }],
    ['limit above int4', { limit: 2147483648 }],
    ['non-integer limit', { limit: 10.5 }],
    ['last digits with a letter', { lastDigits: '12a4' }],
    ['last digits too short', { lastDigits: '123' }],
    ['empty title', { title: '   ' }],
    ['title over 60 chars', { title: 'x'.repeat(61) }],
    ['bad color', { color: 'blue' }],
    ['unknown brand', { brand: 'DINERS' }],
  ])('SHOULD reject %s', async (_label, patch) => {
    await expect(setup.execute({ ...mocks.input, ...patch } as never)).rejects.toThrow();
    expect(mocks.creditCardRepository.createCreditCard).not.toHaveBeenCalled();
  });
});

import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('UpdateCreditCardUseCase', () => {
  it('SHOULD update only the given fields AND return the card', async () => {
    const result = await setup.execute({ ...mocks.base, title: 'Renamed' });

    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: mocks.card.id, status: undefined, title: 'Renamed' }),
    );
    expect(result).toBe(mocks.updated);
  });

  it('SHOULD forward null to clear paymentDay and lastDigits', async () => {
    await setup.execute({ ...mocks.base, lastDigits: null, paymentDay: null });

    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ lastDigits: null, paymentDay: null }),
    );
  });

  it('SHOULD archive WHEN status is ARCHIVED', async () => {
    await setup.execute({ ...mocks.base, status: 'ARCHIVED' as never });

    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ARCHIVED' }),
    );
  });

  it('SHOULD end the recurring series of the card WHEN it is archived (spec 034)', async () => {
    await setup.execute({ ...mocks.base, status: 'ARCHIVED' as never });

    expect(mocks.endRecurrences.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.base.accessibleOwners,
      creditCardId: mocks.card.id,
    });
  });

  it('SHOULD NOT end series WHEN the card was already archived OR is not being archived', async () => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce({
      ...mocks.card,
      status: 'ARCHIVED',
    });
    await setup.execute({ ...mocks.base, status: 'ARCHIVED' as never });
    await setup.execute({ ...mocks.base, status: 'ACTIVE' as never });
    await setup.execute({ ...mocks.base, title: 'x' });

    expect(mocks.endRecurrences.execute).not.toHaveBeenCalled();
  });

  it('SHOULD move the card to a family the caller belongs to', async () => {
    await setup.execute({
      ...mocks.base,
      accessibleOwners: [
        ...mocks.base.accessibleOwners,
        { owner: OwnerType.FAMILY, ownerId: 'fam-1' },
      ],
      owner: OwnerType.FAMILY,
      ownerId: 'fam-1',
    });

    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'FAMILY', ownerId: 'fam-1' }),
    );
  });

  it('SHOULD throw Forbidden AND not update WHEN the new owner is not accessible', async () => {
    await expect(
      setup.execute({ ...mocks.base, owner: OwnerType.FAMILY, ownerId: 'foreign-family' }),
    ).rejects.toThrow(ForbiddenException);
    expect(mocks.creditCardRepository.updateCreditCard).not.toHaveBeenCalled();
  });

  it('SHOULD throw NotFound WHEN the card does not exist', async () => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);

    await expect(setup.execute({ ...mocks.base, title: 'x' })).rejects.toThrow(NotFoundException);
  });

  it("SHOULD throw NotFound (never reveal it) WHEN the card is someone else's personal card", async () => {
    await expect(
      setup.execute({
        ...mocks.base,
        accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'spouse' }],
        title: 'x',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.creditCardRepository.updateCreditCard).not.toHaveBeenCalled();
  });

  it.each([
    ['no field', {}],
    ['owner without ownerId', { owner: OwnerType.USER }],
    ['ownerId without owner', { ownerId: 'x' }],
    ['closing day 32', { closingDay: 32 }],
    ['limit 0', { limit: 0 }],
  ])('SHOULD reject %s', async (_label, patch) => {
    await expect(setup.execute({ ...mocks.base, ...patch } as never)).rejects.toThrow();
    expect(mocks.creditCardRepository.updateCreditCard).not.toHaveBeenCalled();
  });

  describe('payment account (spec 035)', () => {
    const id = 'account-id';

    it('SHOULD forward an accessible active payment account', async () => {
      await setup.execute({ ...mocks.base, paymentAccountId: id });

      expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
        expect.objectContaining({ paymentAccountId: id }),
      );
    });

    it('SHOULD throw 404 WHEN the account is missing or not accessible', async () => {
      mocks.accountRepository.findAccountsByIds.mockResolvedValueOnce([]);

      await expect(setup.execute({ ...mocks.base, paymentAccountId: id })).rejects.toThrow(
        NotFoundException,
      );
      expect(mocks.creditCardRepository.updateCreditCard).not.toHaveBeenCalled();
    });

    it('SHOULD throw 422 WHEN the account is archived', async () => {
      mocks.accountRepository.findAccountsByIds.mockResolvedValueOnce([
        { ...mocks.account, status: 'ARCHIVED' },
      ]);

      await expect(setup.execute({ ...mocks.base, paymentAccountId: id })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  it('SHOULD forward null to remove the link without checking any account (spec 035)', async () => {
    await setup.execute({ ...mocks.base, paymentAccountId: null });

    expect(mocks.accountRepository.findAccountsByIds).not.toHaveBeenCalled();
    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ paymentAccountId: null }),
    );
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { ...mocks.base, title: 'Renamed' };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});

describe('archivedAt (spec 052)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-10T15:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  it('SHOULD set archivedAt to now WHEN archiving', async () => {
    await setup.execute({ ...mocks.base, status: 'ARCHIVED' as never });

    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: new Date('2026-10-10T15:00:00Z') }),
    );
  });

  it('SHOULD clear archivedAt WHEN reactivating', async () => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce({
      ...mocks.card,
      status: 'ARCHIVED' as never,
    });
    await setup.execute({ ...mocks.base, status: 'ACTIVE' as never });

    expect(mocks.creditCardRepository.updateCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: null }),
    );
  });

  it('SHOULD NOT move archivedAt WHEN the status does not change', async () => {
    await setup.execute({ ...mocks.base, title: 'Renamed' });

    expect(mocks.creditCardRepository.updateCreditCard.mock.calls[0][0].archivedAt).toBeUndefined();
  });
});

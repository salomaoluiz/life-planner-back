import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD resolve WHEN account and category exist, are accessible, share the owner and the type matches', async () => {
  await expect(setup.execute(mocks.input)).resolves.toEqual({ card: undefined });

  expect(mocks.accountRepository.findAccountById).toHaveBeenCalledWith(mocks.account.id);
  expect(mocks.categoryRepository.findCategoryById).toHaveBeenCalledWith(mocks.category.id);
});

it.each([
  ['missing', undefined],
  ['owned by a stranger', { ...mocks.account, ownerId: 'stranger' }],
])('SHOULD throw NotFound (404) WHEN the account is %s', async (_label, found) => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce(found);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});

it.each([
  ['missing', undefined],
  ['owned by a stranger', { ...mocks.category, ownerId: 'stranger' }],
])('SHOULD throw NotFound (404) WHEN the category is %s', async (_label, found) => {
  mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(found);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});

it('SHOULD throw BadRequest (400) WHEN a USER account is used by a FAMILY transaction (both accessible)', async () => {
  await expect(
    setup.execute({ ...mocks.input, owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
  ).rejects.toThrow(BadRequestException);
});

it('SHOULD throw BadRequest (400) WHEN the account matches but the category belongs to another accessible owner', async () => {
  mocks.categoryRepository.findCategoryById.mockResolvedValueOnce({
    ...mocks.category,
    owner: OwnerType.FAMILY,
    ownerId: mocks.familyId,
  });

  await expect(setup.execute(mocks.input)).rejects.toThrow(BadRequestException);
});

it('SHOULD throw BadRequest (400) WHEN the category type differs from the transaction type', async () => {
  await expect(setup.execute({ ...mocks.input, type: TransactionType.INCOME })).rejects.toThrow(
    BadRequestException,
  );
});

describe('archived accounts and system categories (spec 028)', () => {
  const archived = { ...mocks.account, status: AccountStatus.ARCHIVED };

  it('SHOULD throw Unprocessable (422) WHEN blockArchivedAccount is set AND the account is archived', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce(archived);

    await expect(setup.execute({ ...mocks.input, blockArchivedAccount: true })).rejects.toThrow(
      new UnprocessableEntityException('Account is archived'),
    );
  });

  it('SHOULD still accept an archived account WHEN the transaction stays on it (flag not set)', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce(archived);

    await expect(setup.execute(mocks.input)).resolves.toEqual({ card: undefined });
  });

  it('SHOULD check the account is accessible BEFORE it reveals it is archived (404 first)', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...archived,
      ownerId: 'stranger',
    });

    await expect(setup.execute({ ...mocks.input, blockArchivedAccount: true })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD throw Unprocessable (422) BEFORE any lookup WHEN the category is a system category', async () => {
    await expect(
      setup.execute({
        ...mocks.input,
        categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT],
      }),
    ).rejects.toThrow(new UnprocessableEntityException('System category is reserved'));
    expect(mocks.accountRepository.findAccountById).not.toHaveBeenCalled();
    expect(mocks.categoryRepository.findCategoryById).not.toHaveBeenCalled();
  });
});

describe('credit card purchases (spec 029)', () => {
  it('SHOULD return the card WHEN it is accessible, active, of the same owner AND the type is EXPENSE', async () => {
    await expect(
      setup.execute({ ...mocks.cardInput, blockArchivedAccount: true }),
    ).resolves.toEqual({ card: mocks.card });
    expect(mocks.accountRepository.findAccountById).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['owned by a stranger', { ...mocks.card, ownerId: 'stranger' }],
  ])('SHOULD throw NotFound (404) WHEN the card is %s', async (_label, found) => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(found);

    await expect(setup.execute(mocks.cardInput)).rejects.toThrow(NotFoundException);
  });

  it('SHOULD throw BadRequest (400) WHEN the type is INCOME', async () => {
    await expect(
      setup.execute({ ...mocks.cardInput, type: TransactionType.INCOME }),
    ).rejects.toThrow(BadRequestException);
  });

  it('SHOULD throw Unprocessable (422) for an archived card ONLY WHEN blocking is requested', async () => {
    mocks.creditCardRepository.findCreditCardById.mockResolvedValue({
      ...mocks.card,
      status: AccountStatus.ARCHIVED,
    });

    await expect(setup.execute({ ...mocks.cardInput, blockArchivedAccount: true })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(setup.execute(mocks.cardInput)).resolves.toEqual(
      expect.objectContaining({ card: expect.anything() }),
    );
  });

  it('SHOULD throw BadRequest (400) WHEN the transaction owner is not the card owner', async () => {
    await expect(
      setup.execute({ ...mocks.cardInput, owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
    ).rejects.toThrow(BadRequestException);
  });

  it('SHOULD throw ValidationError WHEN both or neither source is sent', async () => {
    await expect(
      setup.execute({ ...mocks.cardInput, accountId: mocks.account.id }),
    ).rejects.toThrow();
    await expect(setup.execute({ ...mocks.cardInput, creditCardId: undefined })).rejects.toThrow();
  });
});

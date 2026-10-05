import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD resolve WHEN account and category exist, are accessible, share the owner and the type matches', async () => {
  await expect(setup.execute(mocks.input)).resolves.toBeUndefined();

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

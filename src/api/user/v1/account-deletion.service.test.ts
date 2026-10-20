import { UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { LogLevel } from '@shared/infra/logger/types';

import { mocks, setup } from './account-deletion.service.mocks';

const input = { email: 'test@example.com' };

it('SHOULD run the steps in order: confirm email, owned families, purges, family removal, user delete LAST', async () => {
  const order: string[] = [];
  mocks.confirmUserEmail.execute.mockImplementation(async () => {
    order.push('confirm');
    return { email: 'test@example.com' };
  });
  mocks.getOwnedFamilyIds.execute.mockImplementation(async () => {
    order.push('owned');
    return ['family-1'];
  });
  mocks.getUserFamilyIds.execute.mockResolvedValue(['family-1']);
  mocks.detachCategoryCreator.execute.mockImplementation(async () => {
    order.push('detach');
    return 1;
  });
  mocks.purges.finance.execute.mockImplementation(async () => {
    order.push('finance');
    return 1;
  });
  mocks.purges.stock.execute.mockImplementation(async () => {
    order.push('stock');
    return 1;
  });
  mocks.removeUserFromFamilies.execute.mockImplementation(async () => {
    order.push('families');
    return { families: 1, memberships: 0 };
  });
  mocks.deleteUser.execute.mockImplementation(async () => {
    order.push('user');
  });

  await setup.deleteAccount(mocks.userId, input);

  expect(order).toEqual([
    'confirm',
    'owned',
    'detach',
    'finance',
    'stock',
    'finance',
    'stock',
    'families',
    'user',
  ]);
});

it('SHOULD purge the USER owner AND every owned FAMILY owner with every registered purge', async () => {
  await setup.deleteAccount(mocks.userId, input);

  for (const purge of [mocks.purges.finance, mocks.purges.stock]) {
    expect(purge.execute).toHaveBeenCalledTimes(3);
    expect(purge.execute).toHaveBeenCalledWith({ owner: OwnerType.USER, ownerId: mocks.userId });
    expect(purge.execute).toHaveBeenCalledWith({ owner: OwnerType.FAMILY, ownerId: 'family-1' });
    expect(purge.execute).toHaveBeenCalledWith({ owner: OwnerType.FAMILY, ownerId: 'family-2' });
  }
});

it('SHOULD only purge the USER owner WHEN the user owns no family (joined families are kept)', async () => {
  mocks.getOwnedFamilyIds.execute.mockResolvedValueOnce([]);

  await setup.deleteAccount(mocks.userId, input);

  expect(mocks.purges.finance.execute).toHaveBeenCalledTimes(1);
  expect(mocks.purges.finance.execute).toHaveBeenCalledWith({
    owner: OwnerType.USER,
    ownerId: mocks.userId,
  });
});

it('SHOULD pass the token user id AND the stored email (not the typed one) to the removal step', async () => {
  await setup.deleteAccount(mocks.userId, { email: 'TEST@example.com' });

  expect(mocks.removeUserFromFamilies.execute).toHaveBeenCalledWith({
    email: 'test@example.com',
    userId: mocks.userId,
  });
  expect(mocks.deleteUser.execute).toHaveBeenCalledWith({ id: mocks.userId });
});

it('SHOULD stop at the first failing step AND NOT delete the user (500, retry finishes the job)', async () => {
  mocks.purges.finance.execute.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.deleteAccount(mocks.userId, input)).rejects.toThrow('db down');
  expect(mocks.removeUserFromFamilies.execute).not.toHaveBeenCalled();
  expect(mocks.deleteUser.execute).not.toHaveBeenCalled();
});

it('SHOULD touch nothing WHEN the email does not match (422 from the confirm step)', async () => {
  mocks.confirmUserEmail.execute.mockRejectedValueOnce(
    new UnprocessableEntityException('Email does not match'),
  );

  await expect(setup.deleteAccount(mocks.userId, { email: 'other@example.com' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(mocks.getOwnedFamilyIds.execute).not.toHaveBeenCalled();
  expect(mocks.purges.finance.execute).not.toHaveBeenCalled();
  expect(mocks.deleteUser.execute).not.toHaveBeenCalled();
});

it('SHOULD log the user id and counts per module only (no email, no names)', async () => {
  await setup.deleteAccount(mocks.userId, input);

  expect(mocks.logger.log).toHaveBeenCalledTimes(1);
  const [level, message, args] = mocks.logger.log.mock.calls[0];
  expect(level).toBe(LogLevel.INFO);
  expect(args).toEqual({
    families: 2,
    memberships: 1,
    module: 'AccountDeletionService',
    purged: { finance: 15, stock: 15 },
    userId: mocks.userId,
  });
  expect(JSON.stringify([message, args])).not.toContain('example.com');
});

it('SHOULD NOT log success WHEN a step fails', async () => {
  mocks.deleteUser.execute.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.deleteAccount(mocks.userId, input)).rejects.toThrow('db down');
  expect(mocks.logger.log).not.toHaveBeenCalled();
});

it('SHOULD give EVERY family the user belongs to (owned or joined) its own copy of their All categories', async () => {
  await setup.deleteAccount(mocks.userId, input);

  expect(mocks.detachCategoryCreator.execute).toHaveBeenCalledTimes(2);
  expect(mocks.detachCategoryCreator.execute).toHaveBeenCalledWith({
    familyId: 'family-1',
    userId: mocks.userId,
  });
  expect(mocks.detachCategoryCreator.execute).toHaveBeenCalledWith({
    familyId: 'family-3',
    userId: mocks.userId,
  });
  expect(mocks.detachTagCreator.execute).toHaveBeenCalledTimes(2);
});

it('SHOULD NOT purge anything WHEN the detach step fails (retry finishes the job)', async () => {
  mocks.detachCategoryCreator.execute.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.deleteAccount(mocks.userId, input)).rejects.toThrow('db down');
  expect(mocks.purges.finance.execute).not.toHaveBeenCalled();
  expect(mocks.deleteUser.execute).not.toHaveBeenCalled();
});

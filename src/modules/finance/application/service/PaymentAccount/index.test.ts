import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceAccountRepository } from '@finance/domain/repository';

import { assertPaymentAccount } from './index';

function repo(accounts: unknown[]) {
  return {
    findAccountsByIds: jest.fn().mockResolvedValue(accounts),
  } as unknown as IFinanceAccountRepository;
}

describe('assertPaymentAccount', () => {
  const account = new AccountEntityFixture().build();
  const access = [{ owner: account.owner, ownerId: account.ownerId }];

  it('SHOULD pass for an accessible active account', async () => {
    await expect(
      assertPaymentAccount(repo([account]), access, account.id, 'BRL'),
    ).resolves.toBeUndefined();
  });

  it('SHOULD throw 404 WHEN the account is missing or not accessible', async () => {
    await expect(assertPaymentAccount(repo([]), access, account.id, 'BRL')).rejects.toThrow(
      NotFoundException,
    );
    await expect(assertPaymentAccount(repo([account]), [], account.id, 'BRL')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD throw 422 WHEN the account is archived', async () => {
    const archived = { ...account, status: AccountStatus.ARCHIVED };

    await expect(assertPaymentAccount(repo([archived]), access, account.id, 'BRL')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

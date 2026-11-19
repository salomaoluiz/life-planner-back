import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey } from '@finance/domain/enum';
import { SplitRuleError } from '@finance/domain/service/SplitRules';

import {
  applySplitRules,
  assertConvertible,
  loadWritableSource,
  resolveCategoryId,
  SPLIT_SOURCE_NOT_ALLOWED,
} from './index';

const account = new AccountEntityFixture().withId('acc-1').build();
const card = new CreditCardEntityFixture().withId('card-1').build();
const owners = [
  { owner: account.owner, ownerId: account.ownerId },
  { owner: card.owner, ownerId: card.ownerId },
];
const accountRepository = { findAccountById: jest.fn() };
const creditCardRepository = { findCreditCardById: jest.fn() };
const repositories = {
  accountRepository: accountRepository as never,
  creditCardRepository: creditCardRepository as never,
};

beforeEach(() => {
  jest.resetAllMocks();
  accountRepository.findAccountById.mockResolvedValue(account);
  creditCardRepository.findCreditCardById.mockResolvedValue(card);
});

describe('applySplitRules', () => {
  it('SHOULD return the result of the rule', () => {
    expect(applySplitRules(() => 7)).toBe(7);
  });

  it('SHOULD turn a rule error into a 422 whose message is the code', () => {
    expect(() =>
      applySplitRules(() => {
        throw new SplitRuleError('SPLIT_TOO_FEW_PARTS');
      }),
    ).toThrow(new UnprocessableEntityException('SPLIT_TOO_FEW_PARTS'));
  });

  it('SHOULD carry the mismatch details', () => {
    try {
      applySplitRules(() => {
        throw new SplitRuleError('SPLIT_TOTAL_MISMATCH', {
          difference: -440,
          partsTotal: 28440,
          total: 28000,
        });
      });
    } catch (error) {
      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        details: { difference: -440, partsTotal: 28440, total: 28000 },
        message: 'SPLIT_TOTAL_MISMATCH',
      });
    }
  });

  it('SHOULD rethrow anything else', () => {
    expect(() =>
      applySplitRules(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
  });
});

describe('resolveCategoryId', () => {
  it('SHOULD prefer the category id AND map the adjustment key to the seeded id', () => {
    expect(resolveCategoryId({ categoryId: 'cat-1' })).toBe('cat-1');
    expect(resolveCategoryId({ systemKey: SystemCategoryKey.SPLIT_ADJUSTMENT })).toBe(
      SYSTEM_CATEGORY_IDS[SystemCategoryKey.SPLIT_ADJUSTMENT],
    );
  });
});

describe('loadWritableSource', () => {
  it('SHOULD load the account AND return its owner', async () => {
    const source = await loadWritableSource(repositories, {
      accessibleOwners: owners,
      accountId: 'acc-1',
    });

    expect(source.account).toBe(account);
    expect(source.owner).toEqual({ owner: account.owner, ownerId: account.ownerId });
  });

  it('SHOULD load the card AND return its owner', async () => {
    const source = await loadWritableSource(repositories, {
      accessibleOwners: owners,
      creditCardId: 'card-1',
    });

    expect(source.card).toBe(card);
  });

  it.each([
    ['both', { accountId: 'a', creditCardId: 'c' }],
    ['neither', {}],
  ])('SHOULD throw 422 WHEN %s account and card are sent', async (_label, ids) => {
    await expect(
      loadWritableSource(repositories, { accessibleOwners: owners, ...ids }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('SHOULD throw NotFound WHEN the caller can not read the source', async () => {
    await expect(
      loadWritableSource(repositories, { accessibleOwners: [], accountId: 'acc-1' }),
    ).rejects.toThrow(NotFoundException);
    creditCardRepository.findCreditCardById.mockResolvedValue(undefined);
    await expect(
      loadWritableSource(repositories, { accessibleOwners: owners, creditCardId: 'card-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SHOULD throw 422 WHEN the owner is an archived family OR the source is archived', async () => {
    await expect(
      loadWritableSource(repositories, {
        accessibleOwners: [{ archived: true, owner: account.owner, ownerId: account.ownerId }],
        accountId: 'acc-1',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    accountRepository.findAccountById.mockResolvedValue({
      ...account,
      status: AccountStatus.ARCHIVED,
    });
    await expect(
      loadWritableSource(repositories, { accessibleOwners: owners, accountId: 'acc-1' }),
    ).rejects.toThrow('Account is archived');
    creditCardRepository.findCreditCardById.mockResolvedValue({
      ...card,
      status: AccountStatus.ARCHIVED,
    });
    await expect(
      loadWritableSource(repositories, { accessibleOwners: owners, creditCardId: 'card-1' }),
    ).rejects.toThrow('Credit card is archived');
  });
});

describe('assertConvertible', () => {
  const ordinary = new TransactionEntityFixture().withDefault().build();

  it('SHOULD accept an ordinary transaction', () => {
    expect(() => assertConvertible(ordinary)).not.toThrow();
  });

  it.each([
    ['an installment', { installmentPlanId: 'plan' }],
    ['a transfer row', { transferId: 'transfer' }],
    ['a projected row', { projected: true }],
    ['a prepayment row', { prepaymentId: 'prepayment' }],
    ['a refund', { refundedTransactionId: 'row' }],
    ['a refunded plan', { refundedPlanId: 'plan' }],
    ['a locked row', { externalLock: 'INVESTMENT' }],
    ['a row already in a split', { splitId: 'split' }],
    [
      'a system category',
      { category: { ...ordinary.category, systemKey: SystemCategoryKey.CARD_REFUND } },
    ],
  ])('SHOULD refuse %s with %s', (_label, overrides) => {
    expect(() =>
      assertConvertible(Object.assign(Object.create(ordinary), ordinary, overrides)),
    ).toThrow(SPLIT_SOURCE_NOT_ALLOWED);
  });
});

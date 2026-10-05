import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetAccountsUseCase } from './index';

// region Mocks

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];

const fixture = new AccountEntityFixture();
const archivedA = fixture.withName('alpha').withStatus(AccountStatus.ARCHIVED).build();
const activeZed = fixture.withName('Zed').build();
const activeBeta = fixture.withName('beta').build();
const activeAlpha = fixture.withName('Alpha').build();

const accountRepositoryMock = {
  findAccounts: jest.fn().mockResolvedValue([archivedA, activeZed, activeBeta, activeAlpha]),
};

// endregion Mocks

let setup: GetAccountsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccounts.mockResolvedValue([
    archivedA,
    activeZed,
    activeBeta,
    activeAlpha,
  ]);

  const module = await Test.createTestingModule({
    providers: [
      GetAccountsUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetAccountsUseCase);
});

const mocks = {
  accessibleOwners,
  accountRepository: accountRepositoryMock,
  accounts: { activeAlpha, activeBeta, activeZed, archivedA },
  familyId,
  userId,
};
const spies = {};

export { mocks, setup, spies };

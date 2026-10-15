import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';

// region Mocks

const account = new AccountEntityFixture().withLedgerBalance(15000).build();

// endregion Mocks

const mocks = { account };
const spies = {};

export { mocks, spies };

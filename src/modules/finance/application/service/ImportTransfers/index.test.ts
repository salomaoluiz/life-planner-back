import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { checkTransferRows } from './index';

const OUT = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_OUT];
const IN = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_IN];
const FEE = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_FEE];

const from = new AccountEntityFixture().withId('acc-a').build();
const to = { ...new AccountEntityFixture().withId('acc-b').build(), currency: 'USD' as const };
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: from.ownerId },
  { owner: OwnerType.USER, ownerId: to.ownerId },
];
const accountRepository = { findAccountsByIds: jest.fn() };

function row(overrides: Record<string, unknown>) {
  return {
    accountId: 'acc-a',
    categoryId: OUT,
    currency: 'BRL',
    date: '2026-11-04',
    description: 'Send',
    line: 2,
    notes: ' note ',
    paid: true,
    transferId: 't1',
    type: 'EXPENSE',
    value: 500000,
    ...overrides,
  } as never;
}
const rows = [
  row({}),
  row({
    accountId: 'acc-b',
    categoryId: IN,
    currency: 'USD',
    date: '2026-11-06',
    line: 3,
    type: 'INCOME',
    value: 92000,
  }),
  row({
    accountId: 'acc-b',
    categoryId: FEE,
    currency: 'USD',
    date: '2026-11-06',
    line: 4,
    value: 350,
  }),
];
const base = {
  accessibleOwners,
  accountRepository: accountRepository as never,
  requesterId: 'user-1',
  today: '2026-11-09',
};

beforeEach(() => {
  jest.clearAllMocks();
  accountRepository.findAccountsByIds.mockResolvedValue([from, to]);
});

it('SHOULD turn a valid group into one transfer with its accounts, amounts, dates, fee AND trimmed notes', async () => {
  const { errors, transfers } = await checkTransferRows({ ...base, rows });

  expect(errors).toEqual([]);
  expect(accountRepository.findAccountsByIds).toHaveBeenCalledTimes(1);
  expect(transfers).toEqual([
    {
      amountIn: 92000,
      amountOut: 500000,
      createdBy: 'user-1',
      dateIn: '2026-11-06',
      dateOut: '2026-11-04',
      description: 'Send',
      fee: 350,
      from: { accountId: 'acc-a', currency: 'BRL', owner: from.owner, ownerId: from.ownerId },
      notes: 'note',
      paid: true,
      to: { accountId: 'acc-b', currency: 'USD', owner: to.owner, ownerId: to.ownerId },
    },
  ]);
});

it('SHOULD default paid to "dated up to today" WHEN the file has no paid column', async () => {
  const { transfers } = await checkTransferRows({
    ...base,
    rows: [row({ paid: undefined, date: '2026-12-01' }), rows[1]].map((item, index) =>
      index === 1 ? ({ ...(item as object), date: '2026-12-02' } as never) : item,
    ),
  });

  expect(transfers[0].paid).toBe(false);
});

it('SHOULD report the grouping errors AND write nothing for that group', async () => {
  const { errors, transfers } = await checkTransferRows({ ...base, rows: [rows[0]] });

  expect(transfers).toEqual([]);
  expect(errors.map((error) => error.code)).toEqual(['TRANSFER_INCOMPLETE']);
});

it.each([
  ['an unknown account', [from], 'ACCOUNT_NOT_FOUND'],
  [
    'an account of an owner the caller cannot access',
    [from, { ...to, ownerId: 'stranger' }],
    'OWNER_NOT_ACCESSIBLE',
  ],
  ['an archived account', [from, { ...to, status: AccountStatus.ARCHIVED }], 'ACCOUNT_ARCHIVED'],
])('SHOULD report %s', async (_label, accounts, code) => {
  accountRepository.findAccountsByIds.mockResolvedValue(accounts);

  const { errors, transfers } = await checkTransferRows({ ...base, rows });

  expect(transfers).toEqual([]);
  expect(errors.map((error) => error.code)).toEqual([code]);
});

it('SHOULD report OWNER_ARCHIVED for an archived family AND CURRENCY_MISMATCH for a wrong currency', async () => {
  const archived = accessibleOwners.map((owner, index) =>
    index === 1 ? { ...owner, archived: true } : owner,
  );

  expect(
    (await checkTransferRows({ ...base, accessibleOwners: archived, rows })).errors.map(
      (error) => error.code,
    ),
  ).toEqual(['OWNER_ARCHIVED']);
  expect(
    (
      await checkTransferRows({
        ...base,
        rows: [rows[0], { ...(rows[1] as object), currency: 'EUR' } as never],
      })
    ).errors.map((error) => error.code),
  ).toEqual(['CURRENCY_MISMATCH']);
});

it('SHOULD skip the account read WHEN there are no transfer rows', async () => {
  expect(await checkTransferRows({ ...base, rows: [] })).toEqual({ errors: [], transfers: [] });
  expect(accountRepository.findAccountsByIds).not.toHaveBeenCalled();
});

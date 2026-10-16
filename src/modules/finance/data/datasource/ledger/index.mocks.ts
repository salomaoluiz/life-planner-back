import { Prisma } from '@db/client';

// region Mocks

const queryRawSpy = jest.fn();
const accountUpdateSpy = jest.fn();
const paymentFindFirstSpy = jest.fn();
const txMock = {
  $queryRaw: queryRawSpy,
  financialAccount: { update: accountUpdateSpy },
  financialInvoicePayment: { findFirst: paymentFindFirstSpy },
} as unknown as Prisma.TransactionClient;

// endregion Mocks

beforeEach(() => {
  jest.clearAllMocks();
});

const mocks = { tx: txMock };
const spies = {
  accountUpdate: accountUpdateSpy,
  paymentFindFirst: paymentFindFirstSpy,
  queryRaw: queryRawSpy,
};

export { mocks, spies };

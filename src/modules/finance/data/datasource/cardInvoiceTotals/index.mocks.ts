import { Prisma } from '@db/client';

// region Mocks

const executeRawSpy = jest.fn();
const findManySpy = jest.fn();
const txMock = {
  $executeRaw: executeRawSpy,
  financialTransaction: { findMany: findManySpy },
} as unknown as Prisma.TransactionClient;

// endregion Mocks

beforeEach(() => {
  jest.clearAllMocks();
  executeRawSpy.mockResolvedValue(1);
});

const mocks = { tx: txMock };
const spies = { executeRaw: executeRawSpy, findMany: findManySpy };

export { mocks, spies };

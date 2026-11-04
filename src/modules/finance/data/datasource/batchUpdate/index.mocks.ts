import { Prisma } from '@db/client';

// region Mocks

const executeRawSpy = jest.fn();
const txMock = { $executeRaw: executeRawSpy } as unknown as Prisma.TransactionClient;

// endregion Mocks

beforeEach(() => {
  jest.clearAllMocks();
  // Each statement reports the number of rows it was given (one `?` per row is not visible, so count by values).
  executeRawSpy.mockImplementation(async (sql: Prisma.Sql) => sql.values.length);
});

const mocks = { tx: txMock };
const spies = { executeRaw: executeRawSpy };

export { mocks, spies };

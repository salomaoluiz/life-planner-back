import { Database } from '@shared/infra/db/Database';

import { AiUsageDatasource } from './index';

const queryRaw = jest.fn();
const executeRaw = jest.fn();
const findMany = jest.fn();
const db = { client: { $executeRaw: executeRaw, $queryRaw: queryRaw, aiUsageDaily: { findMany } } };
const datasource = new AiUsageDatasource(db as unknown as Database);

beforeEach(() => jest.clearAllMocks());

describe('consume', () => {
  it('SHOULD return null WITHOUT cleaning WHEN the statement returns no row (limit reached)', async () => {
    queryRaw.mockResolvedValue([]);

    expect(await datasource.consume('u', 'LIGHT', '2026-11-23', 50)).toBeNull();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('SHOULD drop old rows on the first call of the day', async () => {
    queryRaw.mockResolvedValue([{ count: 1 }]);

    expect(await datasource.consume('u', 'LIGHT', '2026-11-23', 50)).toBe(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('SHOULD not clean on later calls', async () => {
    queryRaw.mockResolvedValue([{ count: 5 }]);

    expect(await datasource.consume('u', 'LIGHT', '2026-11-23', 50)).toBe(5);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

it('SHOULD read the counters of the day', async () => {
  findMany.mockResolvedValue([{ count: 2, kind: 'LIGHT' }]);

  expect(await datasource.findDay('u', '2026-11-23')).toEqual([{ count: 2, kind: 'LIGHT' }]);
  expect(findMany).toHaveBeenCalledWith({
    select: { count: true, kind: true },
    where: { day: new Date('2026-11-23T00:00:00.000Z'), user_id: 'u' },
  });
});

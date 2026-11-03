import type { Database } from './Database';
import { mocks, setup, spies } from './Database.mocks';
import { QueryCounter } from './QueryCounter';

describe('Database', () => {
  it('SHOULD initialize PrismaPg and PrismaClient with correct configuration', () => {
    expect(spies.prismaPg).toHaveBeenCalledTimes(1);
    expect(spies.prismaPg).toHaveBeenCalledWith({
      connectionString: `postgresql://${mocks.envService.dbUser}:${mocks.envService.dbPassword}@${mocks.envService.dbHost}:${mocks.envService.dbPort}/${mocks.envService.dbName}`,
      connectionTimeoutMillis: 0,
      idleTimeoutMillis: 30000,
      max: 20,
    });

    expect(spies.prismaClient).toHaveBeenCalledTimes(1);
    expect(spies.prismaClient).toHaveBeenCalledWith({
      adapter: mocks.prismaPgInstance,
    });
  });

  it('SHOULD NOT pass statement_timeout WHEN it is 0', () => {
    expect(spies.prismaPg.mock.calls[0][0]).not.toHaveProperty('statement_timeout');
  });

  it('SHOULD URL-encode the user and password in the connection string', () => {
    const env = { ...mocks.envService, dbPassword: 'p@ss/w:rd#1', dbUser: 'us/er' };

    const DatabaseClass = setup.constructor as new (env: typeof mocks.envService) => Database;
    new DatabaseClass(env as typeof mocks.envService);

    expect(spies.prismaPg).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectionString: 'postgresql://us%2Fer:p%40ss%2Fw%3Ard%231@localhost:5432/test_db',
      }),
    );
  });

  it('SHOULD pass the pool settings AND the statement timeout WHEN configured', () => {
    const env = {
      ...mocks.envService,
      dbPoolConnectionTimeoutMs: 5000,
      dbPoolIdleTimeoutMs: 10000,
      dbPoolMax: 25,
      dbStatementTimeoutMs: 15000,
    };

    const DatabaseClass = setup.constructor as new (env: typeof mocks.envService) => Database;
    new DatabaseClass(env as typeof mocks.envService);

    expect(spies.prismaPg).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        max: 25,
        statement_timeout: 15000,
      }),
    );
  });

  it('SHOULD return the prisma client instance via getter', () => {
    expect(setup.client).toBe(mocks.prismaClientInstance);
  });

  it('SHOULD enable the query counter WHEN perfCountQueries is true', () => {
    const DatabaseClass = setup.constructor as new (env: typeof mocks.envService) => Database;
    new DatabaseClass({
      ...mocks.envService,
      perfCountQueries: true,
    } as unknown as typeof mocks.envService);

    expect(jest.mocked(QueryCounter.enable)).toHaveBeenCalledTimes(1);
  });

  it('SHOULD not touch the query counter WHEN perfCountQueries is false', () => {
    expect(jest.mocked(QueryCounter.enable)).not.toHaveBeenCalled();
  });
});

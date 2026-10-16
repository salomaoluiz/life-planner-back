import type { Database } from './Database';
import { mocks, setup, spies } from './Database.mocks';

describe('Database', () => {
  it('SHOULD initialize PrismaPg and PrismaClient with correct configuration', () => {
    expect(spies.prismaPg).toHaveBeenCalledTimes(1);
    expect(spies.prismaPg).toHaveBeenCalledWith({
      connectionString: `postgresql://${mocks.envService.dbUser}:${mocks.envService.dbPassword}@${mocks.envService.dbHost}:${mocks.envService.dbPort}/${mocks.envService.dbName}`,
    });

    expect(spies.prismaClient).toHaveBeenCalledTimes(1);
    expect(spies.prismaClient).toHaveBeenCalledWith({
      adapter: mocks.prismaPgInstance,
    });
  });

  it('SHOULD URL-encode the user and password in the connection string', () => {
    const env = { ...mocks.envService, dbPassword: 'p@ss/w:rd#1', dbUser: 'us/er' };

    const DatabaseClass = setup.constructor as new (env: typeof mocks.envService) => Database;
    new DatabaseClass(env as typeof mocks.envService);

    expect(spies.prismaPg).toHaveBeenLastCalledWith({
      connectionString: 'postgresql://us%2Fer:p%40ss%2Fw%3Ard%231@localhost:5432/test_db',
    });
  });

  it('SHOULD return the prisma client instance via getter', () => {
    expect(setup.client).toBe(mocks.prismaClientInstance);
  });
});

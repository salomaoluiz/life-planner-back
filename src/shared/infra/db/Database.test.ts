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

  it('SHOULD return the prisma client instance via getter', () => {
    expect(setup.client).toBe(mocks.prismaClientInstance);
  });
});

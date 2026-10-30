import { AppEnvironment, ChangelogSectionType } from '@version/domain/entity/VersionInfo';

import { mocks, setup, spies } from './index.mocks';

const SECOND = 1000;

describe('GetVersionInfoUseCase', () => {
  it('SHOULD combine the local build info with the latest releases of both repos', async () => {
    const result = await setup.execute({ refresh: false });

    expect(result.environment).toBe(AppEnvironment.PRODUCTION);
    expect(result.api).toMatchObject({
      builtAt: '2026-10-27T21:40:00Z',
      current: '1.12.0',
      latest: '1.13.0',
      latestUrl: 'https://github.com/your-org/your-repo/releases/tag/v1.13.0',
      releasedAt: '2026-10-27',
      updateAvailable: true,
    });
    expect(result.api.releases.map((r) => r.version)).toEqual(['1.13.0', '1.12.0']);
    expect(result.api.releases[0].sections).toEqual([
      { items: ['thing'], type: ChangelogSectionType.ADDED },
    ]);
    expect(result.app).toMatchObject({ latest: '1.5.0' });
    expect(result.checkedAt).toBe('2026-10-30T10:00:00.000Z');
    expect(typeof result.api.startedAt).toBe('string');
  });

  it('SHOULD report no update WHEN the API runs the latest version', async () => {
    spies.github.mockResolvedValue([mocks.release('v1.12.0')]);

    expect((await setup.execute({ refresh: false })).api.updateAvailable).toBe(false);
  });

  it('SHOULD make one GitHub call per repo WHEN called twice inside the TTL', async () => {
    await setup.execute({ refresh: false });
    await setup.execute({ refresh: false });

    expect(spies.github).toHaveBeenCalledTimes(2);
  });

  it('SHOULD share one call between concurrent requests', async () => {
    await Promise.all([setup.execute({ refresh: false }), setup.execute({ refresh: false })]);

    expect(spies.github).toHaveBeenCalledTimes(2);
  });

  it('SHOULD refetch after the TTL', async () => {
    await setup.execute({ refresh: false });
    jest.advanceTimersByTime(601 * SECOND);
    await setup.execute({ refresh: false });

    expect(spies.github).toHaveBeenCalledTimes(4);
  });

  it('SHOULD ignore refresh WHEN the cache is younger than 60 s AND honor it when older', async () => {
    await setup.execute({ refresh: false });
    jest.advanceTimersByTime(30 * SECOND);
    await setup.execute({ refresh: true });
    expect(spies.github).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(31 * SECOND);
    await setup.execute({ refresh: true });
    expect(spies.github).toHaveBeenCalledTimes(4);
  });

  it('SHOULD answer with latest null AND log a warning without the token WHEN GitHub fails', async () => {
    spies.github.mockRejectedValue(new Error('timeout of 3000ms exceeded'));

    const result = await setup.execute({ refresh: false });

    expect(result.api).toMatchObject({
      latest: null,
      latestUrl: null,
      releases: [],
      updateAvailable: false,
    });
    expect(result.app).toEqual({ latest: null, latestUrl: null, releases: [] });
    expect(result.checkedAt).toBeNull();
    expect(spies.logger).toHaveBeenCalledWith(spies.warn, 'GitHub release check failed', {
      module: 'GetVersionInfoUseCase',
      reason: 'timeout of 3000ms exceeded',
      repo: 'your-org/your-api',
    });
    expect(JSON.stringify(spies.logger.mock.calls)).not.toContain(mocks.env.githubToken);
  });

  it('SHOULD cache the failure for 60 s only', async () => {
    spies.github.mockRejectedValue(new Error('rate limit'));
    await setup.execute({ refresh: false });
    await setup.execute({ refresh: false });
    expect(spies.github).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(61 * SECOND);
    await setup.execute({ refresh: false });
    expect(spies.github).toHaveBeenCalledTimes(4);
  });

  it('SHOULD NOT call GitHub WHEN the repositories are not configured', async () => {
    Object.assign(mocks.env, { versionRepoApi: undefined, versionRepoApp: undefined });

    const result = await setup.execute({ refresh: false });

    expect(spies.github).not.toHaveBeenCalled();
    expect(result.api.latest).toBeNull();
    expect(result.checkedAt).toBeNull();
  });

  it('SHOULD keep at most 10 releases, newest first', async () => {
    spies.github.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => mocks.release(`v1.${index}.0`)),
    );

    const { releases } = (await setup.execute({ refresh: false })).api;

    expect(releases).toHaveLength(10);
    expect(releases[0].version).toBe('1.11.0');
  });

  it('SHOULD map the staging and development environments', async () => {
    mocks.env.appEnvironment = 'staging';
    expect((await setup.execute({ refresh: false })).environment).toBe(AppEnvironment.STAGING);
  });

  it('SHOULD log an unknown reason WHEN the failure is not an Error', async () => {
    spies.github.mockRejectedValue('boom');
    await setup.execute({ refresh: false });

    expect(spies.logger.mock.calls[0][2]).toMatchObject({ reason: 'unknown' });
  });
});

import axios from 'axios';

import { GithubReleases } from './index';
import { envWith, mocks } from './index.mocks';

jest.mock('axios');

const getSpy = jest.mocked(axios.get);

beforeEach(() => {
  jest.clearAllMocks();
  getSpy.mockResolvedValue({ data: mocks.rawReleases });
});

describe('GithubReleases.listReleases', () => {
  it('SHOULD call the releases endpoint with the 3s timeout AND no Authorization WHEN no token is set', async () => {
    await new GithubReleases(envWith()).listReleases('your-org/your-repo');

    expect(getSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/your-org/your-repo/releases',
      {
        headers: { Accept: 'application/vnd.github+json' },
        params: { per_page: 10 },
        timeout: 3000,
      },
    );
  });

  it('SHOULD send the bearer token WHEN one is set', async () => {
    await new GithubReleases(envWith('your-token')).listReleases('your-org/your-repo');

    expect(getSpy.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer your-token' });
  });

  it('SHOULD ignore drafts and prereleases AND map the fields', async () => {
    const result = await new GithubReleases(envWith()).listReleases('your-org/your-repo');

    expect(result).toEqual([
      {
        body: '### Added\n- thing',
        publishedAt: '2026-10-30T09:00:00Z',
        tagName: 'v1.1.0',
        url: 'https://github.com/your-org/your-repo/releases/tag/v1.1.0',
      },
      { body: '', publishedAt: '', tagName: 'v1.0.0', url: 'https://example.com' },
    ]);
  });

  it('SHOULD return an empty list WHEN the body is not an array', async () => {
    getSpy.mockResolvedValue({ data: { message: 'x' } });

    expect(await new GithubReleases(envWith()).listReleases('your-org/your-repo')).toEqual([]);
  });

  it('SHOULD rethrow WHEN GitHub fails', async () => {
    getSpy.mockRejectedValue(new Error('timeout'));

    await expect(new GithubReleases(envWith()).listReleases('your-org/your-repo')).rejects.toThrow(
      'timeout',
    );
  });

  it.each(['', 'no-slash', 'a/b/c', '../x/y z'])(
    'SHOULD reject the repository "%s"',
    async (repo) => {
      await expect(new GithubReleases(envWith()).listReleases(repo)).rejects.toThrow(
        'Invalid GitHub repository name',
      );
      expect(getSpy).not.toHaveBeenCalled();
    },
  );
});

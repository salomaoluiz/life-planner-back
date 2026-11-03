import { lastValueFrom } from 'rxjs';

import { mocks, run, spies } from './index.mocks';

describe('GIVEN CacheControlInterceptor', () => {
  it('SHOULD set Cache-Control private, no-cache WHEN a GET succeeds on a non-public route', async () => {
    const value = await lastValueFrom(run());

    expect(value).toBe('body');
    expect(spies.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache');
  });

  it('SHOULD NOT set it WHEN the route is public', async () => {
    spies.isPublic.mockReturnValue(true);

    await lastValueFrom(run());

    expect(spies.setHeader).not.toHaveBeenCalled();
  });

  it('SHOULD NOT set it WHEN the method is not GET', async () => {
    mocks.request.method = 'POST';

    await lastValueFrom(run());

    expect(spies.setHeader).not.toHaveBeenCalled();
  });

  it('SHOULD NOT set it WHEN the handler throws', async () => {
    await expect(lastValueFrom(run(mocks.failingHandler))).rejects.toThrow('boom');

    expect(spies.setHeader).not.toHaveBeenCalled();
  });
});

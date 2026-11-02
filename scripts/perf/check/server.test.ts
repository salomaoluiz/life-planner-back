import { EventEmitter } from 'node:events';

import { startServer, waitHealthy } from './server';

describe('startServer', () => {
  it('SHOULD pass PORT and stop only its own child', async () => {
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      kill: jest.fn(() => {
        child.emit('exit');

        return true;
      }),
      killed: false,
    });
    const spawnFn = jest.fn((..._args: unknown[]) => child);
    const server = startServer({
      env: { A: '1' },
      port: 3999,
      spawnFn: spawnFn as never,
    });
    expect((spawnFn.mock.calls[0][2] as { env: NodeJS.ProcessEnv }).env.PORT).toBe('3999');
    await server.stop();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});

describe('waitHealthy', () => {
  it('SHOULD retry until the API answers', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('refused'))
      .mockResolvedValueOnce({ ok: true });
    await expect(waitHealthy('http://x', 5000, fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('SHOULD reject after the timeout', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false });
    await expect(waitHealthy('http://x', 300, fetchFn)).rejects.toThrow(
      'API did not become healthy on http://x',
    );
  });
});

import { ChildProcess, spawn } from 'node:child_process';

export type SpawnFn = (
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; stdio: 'ignore' },
) => ChildProcess;

export interface RunningServer {
  child: ChildProcess;
  stop(): Promise<void>;
}

export function startServer(args: {
  env: NodeJS.ProcessEnv;
  port: number;
  spawnFn?: SpawnFn;
}): RunningServer {
  const spawnFn = args.spawnFn ?? (spawn as SpawnFn);
  const child = spawnFn(process.execPath, ['dist/src/main'], {
    env: { ...args.env, PORT: String(args.port) },
    stdio: 'ignore',
  });

  return {
    child,
    // Signals only the child this script spawned.
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.killed) return resolve();
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
      }),
  };
}

export async function waitHealthy(
  baseUrl: string,
  timeoutMs: number,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetchFn(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become healthy on ${baseUrl}`);
}

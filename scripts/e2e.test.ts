import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, 'e2e.mjs');

interface SetupOptions {
  args?: string[];
  exitCode?: number;
  frontendExists?: boolean;
}

function setup({ args = [], exitCode = 0, frontendExists = true }: SetupOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-entry-'));
  const fakeYarn = join(dir, 'fake-yarn.sh');
  writeFileSync(fakeYarn, '#!/bin/sh\necho "FAKE_YARN $*"\nexit "$FAKE_EXIT"\n');
  chmodSync(fakeYarn, 0o755);
  const frontendDir = frontendExists ? dir : join(dir, 'missing');
  const result = spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      E2E_FRONTEND_DIR: frontendDir,
      E2E_YARN_BIN: fakeYarn,
      FAKE_EXIT: String(exitCode),
    },
  });
  return { frontendDir, result };
}

describe('GIVEN the backend e2e entry point', () => {
  it('SHOULD print E2E NOT RUN and exit 2 WHEN the frontend folder is missing', () => {
    const { result } = setup({ frontendExists: false });

    expect(result.stdout.trim()).toBe('E2E NOT RUN: ../life-planner not found');
    expect(result.status).toBe(2);
  });

  it('SHOULD forward every argument to the frontend runner', () => {
    const { frontendDir, result } = setup({ args: ['--tags', 'stock', '--failed'] });

    expect(result.stdout.trim()).toBe(`FAKE_YARN --cwd ${frontendDir} e2e --tags stock --failed`);
  });

  it.each([0, 1, 2])('SHOULD keep the exit code %i of the frontend runner', (exitCode) => {
    const { result } = setup({ exitCode });

    expect(result.status).toBe(exitCode);
  });
});

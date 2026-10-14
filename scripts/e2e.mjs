// Forwards `yarn e2e [args]` to the frontend runner so both repos run the same suite.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = process.env.E2E_FRONTEND_DIR ?? resolve(backendRoot, '../life-planner');
const yarnBin = process.env.E2E_YARN_BIN ?? 'yarn';

if (!existsSync(frontendDir)) {
  console.log('E2E NOT RUN: ../life-planner not found');
  process.exit(2);
}

const result = spawnSync(yarnBin, ['--cwd', frontendDir, 'e2e', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 2);

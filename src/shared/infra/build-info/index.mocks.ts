import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function tempRoot(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'build-info-'));
  Object.entries(files).forEach(([name, content]) => writeFileSync(join(dir, name), content));
  return dir;
}

const mocks = {
  changelog: '# Changelog\n\n## [1.4.0] - 2026-10-30\n### Added\n- x\n\n## [1.3.0] - 2026-10-01\n',
  packageJson: JSON.stringify({ version: '1.4.0' }),
};

export { mocks, tempRoot };

function readAt(root: string) {
  jest.spyOn(process, 'cwd').mockReturnValue(root);
  return new BuildInfoReader().read();
}

afterEach(() => jest.restoreAllMocks());

import { BuildInfoReader } from './index';
import { mocks, tempRoot } from './index.mocks';

describe('BuildInfoReader.read', () => {
  it('SHOULD read the version, release date and build time', () => {
    const root = tempRoot({
      'build-time': '2026-10-30T10:00:00Z\n',
      'CHANGELOG.md': mocks.changelog,
      'package.json': mocks.packageJson,
    });

    expect(readAt(root)).toEqual({
      builtAt: '2026-10-30T10:00:00Z',
      releasedAt: '2026-10-30',
      version: '1.4.0',
    });
  });

  it('SHOULD return nulls WHEN CHANGELOG.md and build-time are missing', () => {
    const root = tempRoot({ 'package.json': mocks.packageJson });

    expect(readAt(root)).toEqual({
      builtAt: null,
      releasedAt: null,
      version: '1.4.0',
    });
  });

  it('SHOULD fall back to 0.0.0 WHEN package.json is missing or broken', () => {
    expect(readAt(tempRoot({})).version).toBe('0.0.0');
    expect(readAt(tempRoot({ 'package.json': '{' })).version).toBe('0.0.0');
  });

  it('SHOULD return a null release date WHEN the changelog has no entry', () => {
    const root = tempRoot({ 'CHANGELOG.md': '# Changelog\n', 'package.json': mocks.packageJson });

    expect(readAt(root).releasedAt).toBeNull();
  });

  it('SHOULD default to the working directory', () => {
    expect(new BuildInfoReader().read().version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

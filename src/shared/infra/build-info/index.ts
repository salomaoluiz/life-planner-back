import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

import { BuildInfo, IBuildInfo } from './types';

function readText(path: string): null | string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// Version from package.json, release date from the first CHANGELOG.md entry, build time from the
// `build-time` file written during the image build. Nothing here touches .git.
@Injectable()
export class BuildInfoReader implements IBuildInfo {
  read(): BuildInfo {
    const root = process.cwd();
    const packageJson = readText(join(root, 'package.json'));
    const changelog = readText(join(root, 'CHANGELOG.md'));
    const builtAt = readText(join(root, 'build-time'))?.trim();
    let version = '0.0.0';

    if (packageJson) {
      try {
        version = (JSON.parse(packageJson) as { version?: string }).version ?? version;
      } catch {
        // keep the fallback
      }
    }

    return {
      builtAt: builtAt === undefined || builtAt === '' ? null : builtAt,
      releasedAt: changelog
        ? (/^## \[[^\]]+\] - (\d{4}-\d{2}-\d{2})/m.exec(changelog)?.[1] ?? null)
        : null,
      version,
    };
  }
}

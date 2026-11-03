import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hashConfig, writeManifest } from './manifest';

describe('manifest', () => {
  it('writes only the manifest keys', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'seed-')), 'm.json');

    writeManifest(path, {
      configHash: hashConfig({ a: 1 }),
      fingerprint: { stock: 1 },
      counts: { stock: 1 },
      familyIds: ['f1'],
      referenceMonth: '2026-10',
      seededAt: '2026-11-02T00:00:00.000Z',
      userId: 'u1',
    });

    const text = readFileSync(path, 'utf8');
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      'configHash',
      'counts',
      'familyIds',
      'fingerprint',
      'referenceMonth',
      'seededAt',
      'userId',
    ]);
    expect(text).not.toMatch(/@|localhost|password|token/i);
  });

  it('hashes the same config to the same value', () => {
    expect(hashConfig({ a: 1 })).toBe(hashConfig({ a: 1 }));
    expect(hashConfig({ a: 1 })).not.toBe(hashConfig({ a: 2 }));
  });
});

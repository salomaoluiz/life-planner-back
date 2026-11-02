import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export interface SeedManifest {
  configHash: string;
  counts: Record<string, number>;
  familyIds: string[];
  referenceMonth: string;
  seededAt: string;
  userId: string;
}

export function hashConfig(config: unknown): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 16);
}

export function writeManifest(path: string, manifest: SeedManifest): void {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

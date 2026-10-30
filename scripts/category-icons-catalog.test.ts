import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Icon {
  common: boolean;
  group: string;
  keywords: string[];
  name: string;
  sort: number;
}

const GROUPS = [
  'FOOD',
  'HOME',
  'BILLS',
  'TRANSPORT',
  'HEALTH',
  'EDUCATION',
  'LEISURE',
  'SHOPPING',
  'FINANCE',
  'PETS',
  'TRAVEL',
  'WORK',
  'FAMILY',
  'SERVICES',
  'TECH',
  'OTHER',
];
const LEGACY = [
  'folder',
  'food',
  'car',
  'home',
  'medical-bag',
  'school',
  'airplane',
  'gift',
  'cart',
  'bank',
  'cash',
  'credit-card',
  'water',
  'lightning-bolt',
  'wifi',
  'controller',
  'dumbbell',
  'heart',
];

const root = join(__dirname, '..');
const icons: Icon[] = JSON.parse(
  readFileSync(join(root, 'prisma/data/category-icons.json'), 'utf8'),
);
const migrationDir = 'prisma/migrations/20261030000100_category_icons/migration.sql';

describe('category icon catalog (spec 058)', () => {
  it('has at least 180 unique icons in the 16 groups', () => {
    expect(icons.length).toBeGreaterThanOrEqual(180);
    expect(new Set(icons.map((icon) => icon.name)).size).toBe(icons.length);
    expect(new Set(icons.map((icon) => icon.sort)).size).toBe(icons.length);
    expect([...new Set(icons.map((icon) => icon.group))].sort()).toEqual([...GROUPS].sort());
  });

  it('keeps every icon used before the spec and the import default', () => {
    const names = icons.map((icon) => icon.name);

    for (const name of [...LEGACY, 'shape-outline']) {
      expect(names).toContain(name);
    }
  });

  it('marks exactly the first 12 legacy icons as common', () => {
    expect(
      icons
        .filter((icon) => icon.common)
        .map((icon) => icon.name)
        .sort(),
    ).toEqual(LEGACY.slice(0, 12).sort());
  });

  it('gives every icon at least 3 keywords and the folder its synonyms', () => {
    for (const icon of icons) {
      expect(icon.keywords.length).toBeGreaterThanOrEqual(3);
    }
    const folder = icons.find((icon) => icon.name === 'folder')!;

    for (const word of ['pasta', 'folder', 'arquivo', 'ficheiro', 'doc']) {
      expect(folder.keywords).toContain(word);
    }
  });

  it('has a migration that creates the extensions, wrappers, generated column, indexes and every row', () => {
    const sql = readFileSync(join(root, migrationDir), 'utf8');

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS unaccent');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(sql).toContain('immutable_unaccent');
    expect(sql).toContain('GENERATED ALWAYS AS');
    expect(sql).toContain('USING GIN');
    for (const icon of icons) {
      expect(sql).toContain(`('${icon.name}', `);
    }
  });
});

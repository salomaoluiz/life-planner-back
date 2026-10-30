import { ChangelogSectionType } from '@version/domain/entity/VersionInfo';

import { ChangelogNotes } from './index';
import { mocks } from './index.mocks';

describe('ChangelogNotes.parse', () => {
  it('SHOULD group bullets by heading AND strip links and emphasis', () => {
    expect(ChangelogNotes.parse(mocks.bodyWithLinks)).toEqual([
      { items: ['Link bold thing'], type: ChangelogSectionType.ADDED },
      { items: ['a'], type: ChangelogSectionType.FIXED },
    ]);
  });

  it('SHOULD return one CHANGED section WHEN the body has no headings', () => {
    expect(ChangelogNotes.parse(mocks.bodyWithoutHeadings)).toEqual([
      { items: ['First line', 'second line'], type: ChangelogSectionType.CHANGED },
    ]);
  });

  it('SHOULD return an empty list WHEN the body is empty', () => {
    expect(ChangelogNotes.parse('')).toEqual([]);
    expect(ChangelogNotes.parse('   \n')).toEqual([]);
  });

  it('SHOULD keep at most 10 bullets per section', () => {
    expect(ChangelogNotes.parse(mocks.manyBullets)[0].items).toHaveLength(10);
  });

  it('SHOULD cut a bullet to 300 characters', () => {
    const [section] = ChangelogNotes.parse(`### Added\n- ${'x'.repeat(400)}`);

    expect(section.items[0]).toHaveLength(300);
  });

  it('SHOULD send the bullets of an unknown heading to CHANGED', () => {
    expect(ChangelogNotes.parse('### Misc\n- thing')).toEqual([
      { items: ['thing'], type: ChangelogSectionType.CHANGED },
    ]);
  });

  it('SHOULD recognise every Keep a Changelog heading', () => {
    const body = ['Added', 'Changed', 'Fixed', 'Removed', 'Security']
      .map((name) => `### ${name}\n- x`)
      .join('\n');

    expect(ChangelogNotes.parse(body).map((section) => section.type)).toEqual([
      'ADDED',
      'CHANGED',
      'FIXED',
      'REMOVED',
      'SECURITY',
    ]);
  });
});

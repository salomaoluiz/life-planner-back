import { normalizeNotes, NOTES_MAX } from './index';

describe('normalizeNotes', () => {
  it('SHOULD trim the ends and keep inner line breaks', () => {
    expect(normalizeNotes('  a\nb  ')).toBe('a\nb');
  });

  it.each(['   ', '', ' \n ', undefined, null])('SHOULD turn %j into null', (value) => {
    expect(normalizeNotes(value)).toBeNull();
  });

  it('SHOULD expose the 1000 character limit', () => {
    expect(NOTES_MAX).toBe(1000);
  });
});

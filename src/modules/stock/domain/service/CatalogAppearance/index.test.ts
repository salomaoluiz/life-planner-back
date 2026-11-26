import { DEFAULT_COLOR, DEFAULT_ICON, isHexColor } from './index';

it('SHOULD accept #RRGGBB in any case', () => {
  expect(isHexColor('#a1B2c3')).toBe(true);
  expect(isHexColor(DEFAULT_COLOR)).toBe(true);
});

it('SHOULD refuse anything else', () => {
  expect(isHexColor('a1b2c3')).toBe(false);
  expect(isHexColor('#abc')).toBe(false);
  expect(isHexColor('#gggggg')).toBe(false);
  expect(isHexColor('')).toBe(false);
});

it('SHOULD expose the neutral defaults of FR 13', () => {
  expect(DEFAULT_COLOR).toBe('#8A8F98');
  expect(DEFAULT_ICON).toBe('package-variant');
});

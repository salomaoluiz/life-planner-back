// Spec 125 FR 10-13: the appearance every category and location carries.
export const DEFAULT_COLOR = '#8A8F98';
export const DEFAULT_ICON = 'package-variant';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

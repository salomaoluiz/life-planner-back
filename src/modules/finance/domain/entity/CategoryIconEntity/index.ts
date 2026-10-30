// Spec 058: the curated icon catalog is global (not per owner).
export const CATEGORY_ICON_GROUPS = [
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
] as const;

export interface CategoryIconEntity {
  common: boolean;
  group: string;
  labelEn: string;
  labelPt: string;
  name: string;
  sort: number;
}

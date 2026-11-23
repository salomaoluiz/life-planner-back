export interface SuggestionFields {
  brand?: string;
  categoryId?: string;
  description?: string;
  locationId?: string;
  openedShelfLifeDays?: number;
  packageQuantity?: number;
  unit?: 'kilogram' | 'liter' | 'unit';
}
export type SuggestionNotice =
  | 'AI_NOT_SURE'
  | 'AI_UNAVAILABLE'
  | 'LIMIT_REACHED'
  | 'NOT_FOUND'
  | null;
export type SuggestionSource = 'AI' | 'OPEN_FOOD_FACTS';

// Spec 121 FR 15: every filled field says where it came from.
export interface ItemSuggestion {
  fields: SuggestionFields;
  notice: SuggestionNotice;
  sources: Partial<Record<keyof SuggestionFields, SuggestionSource>>;
}

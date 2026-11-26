export interface CatalogSuggestion {
  color: string;
  icon: string;
  key: string;
  name: string;
}
export type StockLanguage = 'en-US' | 'pt-BR';

interface SuggestionDefinition {
  color: string;
  icon: string;
  key: string;
  names: Record<StockLanguage, string>;
}

// Spec 116 FR 23 and 26 + spec 125 section 6: the editable defaults an owner can ask for, with color and icon.
// The keys are stable; the migration of spec 125 backfills existing rows by these names.
const CATEGORIES: SuggestionDefinition[] = [
  {
    color: '#F59E0B',
    icon: 'cart',
    key: 'GROCERIES',
    names: { 'en-US': 'Groceries', 'pt-BR': 'Mercearia' },
  },
  {
    color: '#22C55E',
    icon: 'leaf',
    key: 'PRODUCE',
    names: { 'en-US': 'Produce', 'pt-BR': 'Hortifrúti' },
  },
  {
    color: '#60A5FA',
    icon: 'cup',
    key: 'DAIRY',
    names: { 'en-US': 'Dairy', 'pt-BR': 'Laticínios' },
  },
  {
    color: '#EF4444',
    icon: 'food-drumstick',
    key: 'MEAT',
    names: { 'en-US': 'Meat', 'pt-BR': 'Carnes' },
  },
  {
    color: '#3B82F6',
    icon: 'bottle-soda',
    key: 'DRINKS',
    names: { 'en-US': 'Drinks', 'pt-BR': 'Bebidas' },
  },
  {
    color: '#14B8A6',
    icon: 'spray-bottle',
    key: 'CLEANING',
    names: { 'en-US': 'Cleaning', 'pt-BR': 'Limpeza' },
  },
  {
    color: '#8B5CF6',
    icon: 'toothbrush',
    key: 'HYGIENE',
    names: { 'en-US': 'Hygiene', 'pt-BR': 'Higiene' },
  },
  {
    color: '#EC4899',
    icon: 'pill',
    key: 'PHARMACY',
    names: { 'en-US': 'Pharmacy', 'pt-BR': 'Farmácia' },
  },
  {
    color: '#8A8F98',
    icon: 'hammer-wrench',
    key: 'HOME_TOOLS',
    names: { 'en-US': 'Home/Tools', 'pt-BR': 'Casa/Ferramentas' },
  },
];
const LOCATIONS: SuggestionDefinition[] = [
  {
    color: '#F59E0B',
    icon: 'archive',
    key: 'PANTRY',
    names: { 'en-US': 'Pantry', 'pt-BR': 'Despensa' },
  },
  {
    color: '#3B82F6',
    icon: 'fridge',
    key: 'FRIDGE',
    names: { 'en-US': 'Fridge', 'pt-BR': 'Geladeira' },
  },
  {
    color: '#60A5FA',
    icon: 'snowflake',
    key: 'FREEZER',
    names: { 'en-US': 'Freezer', 'pt-BR': 'Freezer' },
  },
  {
    color: '#14B8A6',
    icon: 'washing-machine',
    key: 'LAUNDRY',
    names: { 'en-US': 'Laundry', 'pt-BR': 'Área de serviço' },
  },
  {
    color: '#8A8F98',
    icon: 'garage',
    key: 'GARAGE',
    names: { 'en-US': 'Garage', 'pt-BR': 'Garagem' },
  },
];

export function categorySuggestions(language: StockLanguage): CatalogSuggestion[] {
  return localized(CATEGORIES, language);
}
export function locationSuggestions(language: StockLanguage): CatalogSuggestion[] {
  return localized(LOCATIONS, language);
}

function localized(definitions: SuggestionDefinition[], language: StockLanguage) {
  return definitions.map(({ color, icon, key, names }) => ({
    color,
    icon,
    key,
    name: names[language],
  }));
}

// FR 24: `keys` omitted = every suggestion; unknown keys are ignored.
export function pickSuggestions(
  suggestions: CatalogSuggestion[],
  keys?: string[],
): CatalogSuggestion[] {
  return keys === undefined ? suggestions : suggestions.filter((entry) => keys.includes(entry.key));
}

export type StockLanguage = 'en-US' | 'pt-BR';

// Spec 116 FR 23 and 26: the editable defaults an owner can ask for ("Use suggestions"), unmapped.
const CATEGORIES: Record<StockLanguage, string[]> = {
  'en-US': [
    'Groceries',
    'Produce',
    'Dairy',
    'Meat',
    'Drinks',
    'Cleaning',
    'Hygiene',
    'Pharmacy',
    'Home/Tools',
  ],
  'pt-BR': [
    'Mercearia',
    'Hortifrúti',
    'Laticínios',
    'Carnes',
    'Bebidas',
    'Limpeza',
    'Higiene',
    'Farmácia',
    'Casa/Ferramentas',
  ],
};
const LOCATIONS: Record<StockLanguage, string[]> = {
  'en-US': ['Pantry', 'Fridge', 'Freezer', 'Laundry', 'Garage'],
  'pt-BR': ['Despensa', 'Geladeira', 'Freezer', 'Área de serviço', 'Garagem'],
};

export function defaultCategoryNames(language: StockLanguage): string[] {
  return CATEGORIES[language];
}
export function defaultLocationNames(language: StockLanguage): string[] {
  return LOCATIONS[language];
}

import { categorySuggestions, locationSuggestions, pickSuggestions } from './index';

it('SHOULD name the suggestions by language with their color and icon', () => {
  expect(categorySuggestions('pt-BR')[0]).toEqual({
    color: '#F59E0B',
    icon: 'cart',
    key: 'GROCERIES',
    name: 'Mercearia',
  });
  expect(locationSuggestions('en-US').map((entry) => entry.name)).toEqual([
    'Pantry',
    'Fridge',
    'Freezer',
    'Laundry',
    'Garage',
  ]);
  expect(categorySuggestions('en-US')).toHaveLength(9);
});

it('SHOULD return every suggestion WHEN no keys are given', () => {
  const all = locationSuggestions('en-US');

  expect(pickSuggestions(all)).toBe(all);
});

it('SHOULD keep only the chosen keys and ignore unknown ones', () => {
  const picked = pickSuggestions(categorySuggestions('en-US'), ['DAIRY', 'NOPE']);

  expect(picked.map((entry) => entry.key)).toEqual(['DAIRY']);
});
